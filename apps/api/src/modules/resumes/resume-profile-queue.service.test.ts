import { DOCUMENT_FAILURES } from '@jobflow/shared';
import { getQueueToken } from '@nestjs/bullmq';
import { UnrecoverableError } from 'bullmq';
import { beforeEach, describe, expect, it } from 'vitest';

import { FileStorage } from '../../storage/file-storage.js';
import { AI_JOB_ID, FakeAiRepository } from '../../test/ai.js';
import {
  FakeDocumentsClient,
  RESUME_TEXT,
  SCAN_EXTRACTION,
  SCAN_PAGE_JPEG,
  TEXT_EXTRACTION,
} from '../../test/documents.js';
import { FakeFileStorage } from '../../test/file-storage.js';
import { memoryLog } from '../../test/memory-log.js';
import { compileProcessorModule } from '../../test/processor.js';
import { FakeProfileVersions, PDF, PDF_BYTES, PROFILE_SOURCE } from '../../test/resumes.js';
import {
  BOHDAN_ID,
  CREATION_EVENT_ID,
  OLENA_ID,
  RESUME_VERSION_ID,
} from '../../test/service-fixtures.js';
import { SilentQueue, StubQueue } from '../../test/stub-queues.js';
import { AiService } from '../ai/index.js';
import { DocumentsClient } from './documents-client.js';
import { DocumentsError } from './documents-error.js';
import { ResumeExtractionService } from './resume-extraction.service.js';
import { ResumeProfileQueueService } from './resume-profile-queue.service.js';
import { ResumeVersionsRepository } from './resume-versions.repository.js';

const log = memoryLog();

const PAYLOAD = { userId: OLENA_ID, resumeVersionId: RESUME_VERSION_ID, aiJobId: AI_JOB_ID };

type EventOptions = { payload?: unknown; finalAttempt?: boolean };

const eventWith = ({ payload = PAYLOAD, finalAttempt = false }: EventOptions = {}) => ({
  id: CREATION_EVENT_ID,
  type: 'resume.version_uploaded',
  payload,
  finalAttempt,
});

async function serviceWith(queue: StubQueue = new StubQueue('ai')) {
  const versions = new FakeProfileVersions();
  const documents = new FakeDocumentsClient();
  const storage = new FakeFileStorage();
  const ai = new FakeAiRepository();
  storage.objects.set(PROFILE_SOURCE.storageKey, { bytes: PDF_BYTES, mime: PDF });
  ai.queueJob(OLENA_ID);
  const moduleRef = await compileProcessorModule(log.sink, [
    ResumeProfileQueueService,
    ResumeExtractionService,
    { provide: ResumeVersionsRepository, useValue: versions },
    { provide: DocumentsClient, useValue: documents },
    { provide: FileStorage, useValue: storage },
    { provide: AiService, useValue: ai },
    { provide: getQueueToken('ai'), useValue: queue },
  ]);
  const service = moduleRef.get(ResumeProfileQueueService);
  return { queue, service, versions, documents, storage, ai };
}

const failedWith = (errorType: string) => [
  [AI_JOB_ID, expect.objectContaining({ userId: OLENA_ID, status: 'failed', errorType })],
];

describe('ResumeProfileQueueService.enqueue', () => {
  beforeEach(() => {
    log.lines.length = 0;
  });

  it('extracts the stored file, saves its text and queues the profile job with the text', async () => {
    const { queue, service, versions, documents } = await serviceWith();

    await service.enqueue(eventWith());

    expect(documents.calls).toEqual([
      { bytes: PDF_BYTES, filename: PROFILE_SOURCE.filename, mime: PROFILE_SOURCE.mime },
    ]);
    expect(versions.texts).toEqual([{ id: RESUME_VERSION_ID, text: RESUME_TEXT }]);
    expect(queue.jobs).toEqual([
      {
        id: AI_JOB_ID,
        name: 'ai.complete',
        data: {
          aiJobId: AI_JOB_ID,
          userId: OLENA_ID,
          kind: 'resume_parse',
          input: { text: RESUME_TEXT, pages: [] },
          resumeVersionId: RESUME_VERSION_ID,
        },
      },
    ]);
    expect(log.lines.join('')).not.toContain('TypeScript');
  });

  it('queues the page images of a scan with empty text', async () => {
    const { queue, service, documents } = await serviceWith();
    documents.answer = () => Promise.resolve(SCAN_EXTRACTION);

    await service.enqueue(eventWith());

    expect(queue.jobs.map((job) => job.data)).toEqual([
      expect.objectContaining({ input: { text: '', pages: [SCAN_PAGE_JPEG] } }),
    ]);
  });

  it("does nothing for a version that is gone or another user's", async () => {
    const { queue, service, documents } = await serviceWith();

    await service.enqueue(eventWith({ payload: { ...PAYLOAD, userId: BOHDAN_ID } }));

    expect(documents.calls).toEqual([]);
    expect(queue.jobs).toEqual([]);
  });

  it('does nothing for a version that already holds its profile', async () => {
    const { queue, service, versions, documents } = await serviceWith();
    versions.source = { ...PROFILE_SOURCE, aiProfile: { skills: [] } };

    await service.enqueue(eventWith());

    expect(documents.calls).toEqual([]);
    expect(queue.jobs).toEqual([]);
  });

  it('fails the job as unreadable_file when the stored file is empty or gone', async () => {
    const { queue, service, storage, documents, ai } = await serviceWith();
    storage.objects.delete(PROFILE_SOURCE.storageKey);

    await service.enqueue(eventWith());

    expect(documents.calls).toEqual([]);
    expect(queue.jobs).toEqual([]);
    expect([...ai.jobs]).toEqual(failedWith('unreadable_file'));
  });

  it('saves the blank text and fails the job as needs_text when a text file has no words', async () => {
    const { queue, service, versions, documents, ai } = await serviceWith();
    documents.answer = () => Promise.resolve({ ...TEXT_EXTRACTION, text: ' \n ' });

    await service.enqueue(eventWith());

    expect(versions.texts).toEqual([{ id: RESUME_VERSION_ID, text: ' \n ' }]);
    expect(queue.jobs).toEqual([]);
    expect([...ai.jobs]).toEqual(failedWith('needs_text'));
  });

  it('saves and sends the text without the NUL characters Postgres refuses', async () => {
    const { queue, service, versions, documents } = await serviceWith();
    documents.answer = () => Promise.resolve({ ...TEXT_EXTRACTION, text: 'React\u0000 Jest' });

    await service.enqueue(eventWith());

    expect(versions.texts).toEqual([{ id: RESUME_VERSION_ID, text: 'React Jest' }]);
    expect(queue.jobs.map((job) => job.data)).toEqual([
      expect.objectContaining({ input: { text: 'React Jest', pages: [] } }),
    ]);
  });

  it.each(DOCUMENT_FAILURES)(
    'fails the job as needs_text when the document service refuses it as %s',
    async (type) => {
      const { queue, service, documents, ai } = await serviceWith();
      documents.answer = () => Promise.reject(new DocumentsError({ status: 422, type }));

      await service.enqueue(eventWith());

      expect(queue.jobs).toEqual([]);
      expect([...ai.jobs]).toEqual(failedWith('needs_text'));
    },
  );

  it('rethrows a document service outage so the event is retried and keeps the job queued', async () => {
    const { service, documents, ai } = await serviceWith();
    const outage = new DocumentsError({ status: 504, type: 'documents_timeout' });
    documents.answer = () => Promise.reject(outage);

    await expect(service.enqueue(eventWith())).rejects.toBe(outage);

    expect(ai.jobs.get(AI_JOB_ID)).toEqual({ userId: OLENA_ID, status: 'queued', step: 1 });
  });

  it.each([
    {
      cause: 'a document service timeout',
      error: new DocumentsError({ status: 504, type: 'documents_timeout' }),
      errorType: 'documents_timeout',
    },
    {
      cause: 'an error from outside the document service',
      error: new Error('storage down'),
      errorType: 'not_ready',
    },
  ])('fails the job on the last attempt after $cause', async ({ error, errorType }) => {
    const { service, documents, ai } = await serviceWith();
    documents.answer = () => Promise.reject(error);

    await expect(service.enqueue(eventWith({ finalAttempt: true }))).rejects.toBe(error);

    expect([...ai.jobs]).toEqual(failedWith(errorType));
  });

  it.each([
    {
      payload: 'without an ai job id',
      data: { userId: OLENA_ID, resumeVersionId: RESUME_VERSION_ID },
    },
    { payload: 'that is no object', data: undefined },
  ])('fails an event $payload as unrecoverable and queues nothing', async ({ data }) => {
    const { queue, service } = await serviceWith();

    await expect(service.enqueue({ ...eventWith(), payload: data })).rejects.toBeInstanceOf(
      UnrecoverableError,
    );

    expect(queue.jobs).toEqual([]);
    expect(log.parsed()).toEqual([
      expect.objectContaining({
        level: 50,
        msg: 'resume upload event invalid',
        eventId: CREATION_EVENT_ID,
      }),
    ]);
  });

  it('gives up on a silent queue after the publish limit so the event is retried', async () => {
    const { service } = await serviceWith(new SilentQueue('ai'));

    await expect(service.enqueue(eventWith())).rejects.toThrow('timed out after 2000 ms');
  });
});
