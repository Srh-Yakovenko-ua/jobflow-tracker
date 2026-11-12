import { resumeVersionListResponseSchema } from '@jobflow/shared';
import type { INestApplicationContext } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import { OutboxRelayService } from '../../outbox/outbox-relay.service.js';
import { FakeAiClient, RESUME_COMPLETION, RESUME_PROFILE, storedAiJob } from '../../test/ai.js';
import { useTestApp } from '../../test/app.js';
import { BOHDAN, OLENA, signUp } from '../../test/auth.js';
import { FakeDocumentsClient, RESUME_TEXT, TEXT_EXTRACTION } from '../../test/documents.js';
import { callRoute } from '../../test/http.js';
import { memoryLog } from '../../test/memory-log.js';
import { RESUME_VERSIONS_PATH, uploadResumeVersion } from '../../test/resumes.js';
import { useTestWorkers } from '../../test/worker.js';
import { AiClient, AiServiceError } from '../ai/index.js';
import { DocumentsClient } from './documents-client.js';
import { DocumentsError } from './documents-error.js';
import { ResumeVersionsRepository } from './resume-versions.repository.js';

const WORKER_TEST = { timeout: 30_000 };

const SETTLED = { timeout: 20_000 };

const log = memoryLog();

const ai = new FakeAiClient();

const documents = new FakeDocumentsClient();

type Owner = { accessToken: string };

describe('the AI skills profile of a resume version', () => {
  const testApp = useTestApp();
  const workers = useTestWorkers(log.sink, (builder) =>
    builder
      .overrideProvider(AiClient)
      .useValue(ai)
      .overrideProvider(DocumentsClient)
      .useValue(documents),
  );

  beforeEach(() => {
    ai.calls.length = 0;
    ai.answer = () => Promise.resolve(RESUME_COMPLETION);
    documents.calls.length = 0;
    documents.answer = () => Promise.resolve(TEXT_EXTRACTION);
  });

  const storedVersion = (id: string) =>
    testApp.prisma.resumeVersion.findUniqueOrThrow({
      where: { id },
      select: { textExtracted: true, aiProfile: true },
    });

  const profileJobId = async (resumeVersionId: string) =>
    (await testApp.prisma.aiJob.findFirstOrThrow({ where: { resumeVersionId } })).id;

  async function startedWorker(): Promise<INestApplicationContext> {
    const compiled = await workers.compile();
    return compiled.init();
  }

  async function profiled(worker: INestApplicationContext, owner: Owner) {
    const { version } = await uploadResumeVersion(testApp.app, owner);
    await worker.get(OutboxRelayService, { strict: false }).relay();
    const jobId = await profileJobId(version.id);
    await expect
      .poll(async () => (await storedAiJob(testApp.prisma, jobId)).status, SETTLED)
      .toMatch(/^(done|failed)$/);
    return version;
  }

  async function listedStatuses(owner: Owner) {
    const response = await callRoute(testApp.app, {
      method: 'get',
      path: RESUME_VERSIONS_PATH,
      accessToken: owner.accessToken,
    });
    const { items } = resumeVersionListResponseSchema.parse(response.body);
    return items.map(({ aiProfileStatus }) => aiProfileStatus);
  }

  it(
    'profiles the same file uploaded twice with one AI call and stores the profile on both versions',
    WORKER_TEST,
    async () => {
      const owner = await signUp(testApp.app, OLENA);
      const worker = await startedWorker();

      const first = await profiled(worker, owner);
      const second = await profiled(worker, owner);

      expect(ai.calls).toEqual([
        expect.objectContaining({ kind: 'resume_parse', input: { text: RESUME_TEXT, pages: [] } }),
      ]);
      expect(await Promise.all([first, second].map(({ id }) => storedVersion(id)))).toEqual([
        { textExtracted: RESUME_TEXT, aiProfile: RESUME_PROFILE },
        { textExtracted: RESUME_TEXT, aiProfile: RESUME_PROFILE },
      ]);
      expect(await listedStatuses(owner)).toEqual(['done', 'done']);
      expect(log.lines.join('')).not.toContain('Frontend developer at Acme');
    },
  );

  it(
    'lists the version as needs_text when the AI service finds no resume text',
    WORKER_TEST,
    async () => {
      ai.answer = () => Promise.reject(new AiServiceError({ status: 422, type: 'needs_text' }));
      const owner = await signUp(testApp.app, OLENA);

      const version = await profiled(await startedWorker(), owner);

      expect((await storedAiJob(testApp.prisma, await profileJobId(version.id))).errorType).toBe(
        'needs_text',
      );
      expect(await listedStatuses(owner)).toEqual(['needs_text']);
    },
  );

  it('lists an encrypted PDF as needs_text without an AI call', WORKER_TEST, async () => {
    documents.answer = () =>
      Promise.reject(new DocumentsError({ status: 422, type: 'encrypted_pdf' }));
    const owner = await signUp(testApp.app, OLENA);

    const version = await profiled(await startedWorker(), owner);

    expect(ai.calls).toEqual([]);
    expect(await storedVersion(version.id)).toEqual({ textExtracted: null, aiProfile: null });
    expect(await listedStatuses(owner)).toEqual(['needs_text']);
  });

  it("reads and writes the profile fields of OLENA's version for OLENA only", async () => {
    const olena = await signUp(testApp.app, OLENA);
    const bohdan = await signUp(testApp.app, BOHDAN);
    const { version } = await uploadResumeVersion(testApp.app, olena);
    const versions = testApp.app.get(ResumeVersionsRepository);
    const fields = { id: version.id, text: RESUME_TEXT, profile: RESUME_PROFILE };

    const asBohdan = await Promise.all([
      versions.findForProfile(bohdan.user.id, version.id),
      versions.saveExtractedText(bohdan.user.id, fields),
      versions.saveProfile(bohdan.user.id, fields),
    ]);
    const asOlena = await Promise.all([
      versions.saveExtractedText(olena.user.id, fields),
      versions.saveProfile(olena.user.id, fields),
    ]);

    expect(asBohdan).toEqual([null, 0, 0]);
    expect(asOlena).toEqual([1, 1]);
    expect(await versions.findForProfile(olena.user.id, version.id)).toMatchObject({
      aiProfile: RESUME_PROFILE,
    });
    expect(await storedVersion(version.id)).toEqual({
      textExtracted: RESUME_TEXT,
      aiProfile: RESUME_PROFILE,
    });
  });
});
