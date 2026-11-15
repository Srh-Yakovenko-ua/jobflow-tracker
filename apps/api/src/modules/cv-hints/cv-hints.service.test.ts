import { CV_HINTS_INPUT, CV_HINTS_OUTPUT } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { AI_JOB_ID, FakeAiRepository } from '../../test/ai.js';
import {
  CV_HINTS_SOURCE_ROW,
  FakeCvHintsRepository,
  FakeMatchReader,
} from '../../test/cv-hints.js';
import { FAKE_TRANSACTION, fakeTransactionModule } from '../../test/fake-prisma.js';
import {
  APPLICATION_ID,
  APPLICATION_NOT_FOUND,
  MISSING_TARGETS,
  OLENA_ID,
  RESUME_VERSION_ID,
} from '../../test/service-fixtures.js';
import { minutesAfter, minutesBefore, NOW } from '../../test/time.js';
import { AiService } from '../ai/index.js';
import { MatchService } from '../match/index.js';
import { CvHintsRepository } from './cv-hints.repository.js';
import { CvHintsService } from './cv-hints.service.js';

const RUNNING_JOB_ID = '0199f0a0-0000-7000-8000-0000000000f8';

const CONFLICT = { body: { status: 409, type: 'conflict' } };

async function serviceWithFakes() {
  const repository = new FakeCvHintsRepository();
  const match = new FakeMatchReader();
  const ai = new FakeAiRepository();
  const moduleRef = await fakeTransactionModule({
    providers: [
      CvHintsService,
      { provide: CvHintsRepository, useValue: repository },
      { provide: MatchService, useValue: match },
      { provide: AiService, useValue: ai },
    ],
    now: NOW,
  }).compile();
  const service = moduleRef.get(CvHintsService);
  const generate = (userId = OLENA_ID, applicationId = APPLICATION_ID) =>
    service.request(userId, { applicationId, requestId: 'req-1' });
  return { repository, match, ai, service, generate };
}

const nothingStored = ({ ai, repository }: Awaited<ReturnType<typeof serviceWithFakes>>) => [
  ai.jobs.size,
  repository.recorded.length,
];

describe('CvHintsService.read', () => {
  it('answers the hints of the latest done job for the linked version since the current score', async () => {
    const { repository, service } = await serviceWithFakes();
    repository.latest = {
      id: AI_JOB_ID,
      status: 'done',
      errorType: null,
      finishedAt: minutesAfter(5),
      aiResult: { output: CV_HINTS_OUTPUT },
    };

    await expect(service.read(OLENA_ID, APPLICATION_ID)).resolves.toEqual({
      result: { ...CV_HINTS_OUTPUT, generatedAt: '2026-10-22T09:05:00.000Z' },
      job: { id: AI_JOB_ID, status: 'done', errorType: null },
    });
    expect(repository.latestReads).toEqual([
      { applicationId: APPLICATION_ID, resumeVersionId: RESUME_VERSION_ID, since: NOW },
    ]);
  });

  it.each([
    { case: 'a queued job', status: 'queued', errorType: null },
    { case: 'a failed job', status: 'failed', errorType: 'ai_timeout' },
  ] as const)('answers $case with no result', async ({ status, errorType }) => {
    const { repository, service } = await serviceWithFakes();
    repository.latest = { id: AI_JOB_ID, status, errorType, finishedAt: null, aiResult: null };

    await expect(service.read(OLENA_ID, APPLICATION_ID)).resolves.toEqual({
      result: null,
      job: { id: AI_JOB_ID, status, errorType },
    });
  });

  it('answers a done job whose AI result was deleted with its job and no result', async () => {
    const { repository, service } = await serviceWithFakes();
    const job = { id: AI_JOB_ID, status: 'done', errorType: null } as const;
    repository.latest = { ...job, finishedAt: minutesBefore(1), aiResult: null };

    await expect(service.read(OLENA_ID, APPLICATION_ID)).resolves.toEqual({ result: null, job });
  });

  it('answers nothing and reads no job when the application has no Match Score', async () => {
    const { repository, match, service } = await serviceWithFakes();
    match.response = { match: null, job: null };

    await expect(service.read(OLENA_ID, APPLICATION_ID)).resolves.toEqual({
      result: null,
      job: null,
    });
    expect(repository.latestReads).toEqual([]);
  });

  it.each(MISSING_TARGETS)('answers 404 for $case', async ({ userId, id }) => {
    const { service } = await serviceWithFakes();

    await expect(service.read(userId, id)).rejects.toMatchObject(APPLICATION_NOT_FOUND);
  });
});

describe('CvHintsService.request', () => {
  it('creates a cv_hints job for the linked version and writes the request with the built input in one transaction', async () => {
    const { repository, ai, generate } = await serviceWithFakes();

    await expect(generate()).resolves.toEqual({ jobId: AI_JOB_ID });

    expect(ai.jobs.get(AI_JOB_ID)).toEqual(
      expect.objectContaining({
        applicationId: APPLICATION_ID,
        resumeVersionId: RESUME_VERSION_ID,
      }),
    );
    expect(repository.recorded).toEqual([
      [
        OLENA_ID,
        {
          requested: {
            applicationId: APPLICATION_ID,
            resumeVersionId: RESUME_VERSION_ID,
            aiJobId: AI_JOB_ID,
            requestId: 'req-1',
            input: CV_HINTS_INPUT,
          },
          tx: FAKE_TRANSACTION,
        },
      ],
    ]);
  });

  it('answers the running job instead of creating a second one', async () => {
    const fakes = await serviceWithFakes();
    fakes.repository.runningJobId = RUNNING_JOB_ID;

    await expect(fakes.generate()).resolves.toEqual({ jobId: RUNNING_JOB_ID });

    expect(nothingStored(fakes)).toEqual([0, 0]);
  });

  it('answers 409 and creates no job when the application has no Match Score', async () => {
    const fakes = await serviceWithFakes();
    fakes.match.response = { match: null, job: null };

    await expect(fakes.generate()).rejects.toMatchObject(CONFLICT);
    expect(nothingStored(fakes)).toEqual([0, 0]);
  });

  it.each([
    { case: 'the linked version has no skills profile', resumeVersion: { aiProfile: null } },
    { case: 'the application was relinked to no version', resumeVersion: null },
  ])('answers 409 and creates no job when $case', async ({ resumeVersion }) => {
    const fakes = await serviceWithFakes();
    fakes.repository.source = { ...CV_HINTS_SOURCE_ROW, resumeVersion };

    await expect(fakes.generate()).rejects.toMatchObject(CONFLICT);
    expect(nothingStored(fakes)).toEqual([0, 0]);
  });

  it('answers 409 when the application was relinked to another version since the score', async () => {
    const fakes = await serviceWithFakes();
    fakes.repository.source = { ...CV_HINTS_SOURCE_ROW, resumeVersionId: AI_JOB_ID };

    await expect(fakes.generate()).rejects.toMatchObject(CONFLICT);
    expect(nothingStored(fakes)).toEqual([0, 0]);
  });

  it('answers 422 at position and creates no job when the stored position is one the input refuses', async () => {
    const fakes = await serviceWithFakes();
    fakes.repository.source = { ...CV_HINTS_SOURCE_ROW, position: '' };

    await expect(fakes.generate()).rejects.toMatchObject({
      body: { status: 422, errors: [expect.objectContaining({ path: 'position' })] },
    });
    expect(nothingStored(fakes)).toEqual([0, 0]);
  });

  it.each(MISSING_TARGETS)('answers 404 for $case and creates no job', async ({ userId, id }) => {
    const fakes = await serviceWithFakes();

    await expect(fakes.generate(userId, id)).rejects.toMatchObject(APPLICATION_NOT_FOUND);
    expect(nothingStored(fakes)).toEqual([0, 0]);
  });
});
