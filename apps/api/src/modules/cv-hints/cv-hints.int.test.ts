import { cvHintsResponseSchema } from '@jobflow/shared';
import { CV_HINTS_INPUT, CV_HINTS_OUTPUT } from '@jobflow/shared/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { Prisma } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { CV_HINTS_COMPLETION, FakeAiClient } from '../../test/ai.js';
import { useTestApp } from '../../test/app.js';
import {
  AI_WORKER_TEST,
  applicationAiRoute,
  postedTwice,
  servedFromCache,
} from '../../test/application-ai-route.js';
import { cvHintsPath, type ScoredOwner, scoredOwner } from '../../test/cv-hints.js';
import { createAiJob, createAiResult } from '../../test/factories.js';
import { statusAndType } from '../../test/http.js';
import { memoryLog } from '../../test/memory-log.js';
import { outboxRows } from '../../test/outbox.js';
import { daysBefore } from '../../test/time.js';
import { useTestWorkers } from '../../test/worker.js';
import { AiClient, AiServiceError } from '../ai/index.js';
import { CvHintsRepository } from './cv-hints.repository.js';

const REQUESTED_EVENT = { eventType: 'application.cv_hints_requested' };

const log = memoryLog();

const ai = new FakeAiClient();

describe('the CV hints API', () => {
  const testApp = useTestApp();
  const workers = useTestWorkers(log.sink, (builder) =>
    builder.overrideProvider(AiClient).useValue(ai),
  );

  beforeEach(() => {
    ai.restart(CV_HINTS_COMPLETION);
  });

  const owner = () => scoredOwner(testApp.prisma);

  const route = applicationAiRoute(testApp, { path: cvHintsPath, response: cvHintsResponseSchema });
  const { call, requested, read, settled } = route;

  const cvHintsResultsOf = (userId: string) =>
    testApp.prisma.aiResult.findMany({
      where: { userId, kind: 'cv_hints' },
      select: { status: true, model: true, tokensIn: true, tokensOut: true, latencyMs: true },
    });

  it(
    'answers queued, then done with the hints, and serves the same input again from one cached and costed ai_results row',
    AI_WORKER_TEST,
    async () => {
      const olena = await owner();
      const worker = await workers.compile();

      const { firstId, secondId, whileQueued, first, second } = await servedFromCache(route, {
        caller: olena,
        worker,
      });

      expect(whileQueued).toEqual({
        result: null,
        job: { id: firstId, status: 'queued', errorType: null },
      });
      expect([first.status, second.status]).toEqual(['done', 'done']);
      expect(secondId).not.toBe(firstId);
      expect(second.aiResultId).toBe(first.aiResultId);
      expect(ai.calls).toEqual([
        expect.objectContaining({ kind: 'cv_hints', input: CV_HINTS_INPUT }),
      ]);
      const { model, tokensIn, tokensOut, latencyMs } = CV_HINTS_COMPLETION;
      expect(await cvHintsResultsOf(olena.userId)).toEqual([
        { status: 'succeeded', model, tokensIn, tokensOut, latencyMs },
      ]);
      expect(await read(olena)).toEqual({
        result: { ...CV_HINTS_OUTPUT, generatedAt: second.finishedAt?.toISOString() },
        job: { id: secondId, status: 'done', errorType: null },
      });
    },
  );

  it('writes the request event with the built input and answers the running job to a second request', async () => {
    const olena = await owner();

    const { first, second, jobId, requestId } = await postedTwice(route, olena);

    expect([first.status, second.status]).toEqual([202, 202]);
    expect(second.body).toEqual(first.body);
    expect(await testApp.prisma.aiJob.count({ where: { kind: 'cv_hints' } })).toBe(1);
    expect(await outboxRows(testApp.prisma, REQUESTED_EVENT)).toEqual([
      {
        aggregate: 'application',
        aggregateId: olena.applicationId,
        eventType: REQUESTED_EVENT.eventType,
        payload: {
          userId: olena.userId,
          applicationId: olena.applicationId,
          resumeVersionId: olena.resumeVersionId,
          aiJobId: jobId,
          requestId,
          input: CV_HINTS_INPUT,
        },
      },
    ]);
  });

  it('answers failed with the error type once services/ai times out', AI_WORKER_TEST, async () => {
    ai.answer = () => Promise.reject(new AiServiceError({ status: 504, type: 'ai_timeout' }));
    const olena = await owner();
    const worker = await (await workers.compile()).init();

    const jobId = await requested(olena);
    await settled(worker, jobId);

    expect(await read(olena)).toEqual({
      result: null,
      job: { id: jobId, status: 'failed', errorType: 'ai_timeout' },
    });
  });

  it('answers no hints and no job when the only hints predate the current Match Score', async () => {
    const olena = await owner();
    const aiResultId = await createAiResult(testApp.prisma, {
      userId: olena.userId,
      kind: 'cv_hints',
      output: CV_HINTS_OUTPUT,
    });
    await createAiJob(testApp.prisma, {
      userId: olena.userId,
      applicationId: olena.applicationId,
      resumeVersionId: olena.resumeVersionId,
      kind: 'cv_hints',
      status: 'done',
      aiResultId,
      createdAt: daysBefore(1),
      finishedAt: daysBefore(1),
    });

    expect(await read(olena)).toEqual({ result: null, job: null });
  });

  it.each([
    {
      case: 'no Match Score',
      unscore: (prisma: PrismaService, { applicationId }: ScoredOwner) =>
        prisma.aiJob.deleteMany({ where: { applicationId, kind: 'match' } }),
    },
    {
      case: 'a CV version without a skills profile',
      unscore: (prisma: PrismaService, { resumeVersionId }: ScoredOwner) =>
        prisma.resumeVersion.update({
          where: { id: resumeVersionId },
          data: { aiProfile: Prisma.DbNull },
        }),
    },
  ])(
    'answers 409 to a request for an application with $case and stores no job',
    async ({ unscore }) => {
      const olena = await owner();
      await unscore(testApp.prisma, olena);

      expect(statusAndType(await call('post', olena))).toEqual([409, 'conflict']);
      expect(await testApp.prisma.aiJob.count({ where: { kind: 'cv_hints' } })).toBe(0);
    },
  );

  it.each(['get', 'post'] as const)(
    "answers 404 to %s cv-hints on another user's application and stores nothing",
    async (method) => {
      const olena = await owner();
      const bohdan = await owner();

      const response = await call(method, { ...olena, accessToken: bohdan.accessToken });

      expect(statusAndType(response)).toEqual([404, 'not_found']);
      expect(await testApp.prisma.aiJob.count({ where: { kind: 'cv_hints' } })).toBe(0);
    },
  );

  it.each(['get', 'post'] as const)(
    'answers 401 to %s cv-hints without a token and 422 to a malformed id',
    async (method) => {
      const olena = await owner();

      const responses = await Promise.all([
        call(method, { applicationId: olena.applicationId }),
        call(method, { ...olena, applicationId: 'not-a-uuid' }),
      ]);

      expect(responses.map(({ status }) => status)).toEqual([401, 422]);
    },
  );

  it("reads and locks OLENA's cv hints rows for OLENA only", async () => {
    const olena = await owner();
    const bohdan = await owner();
    const jobId = await requested(olena);
    const repository = testApp.app.get(CvHintsRepository);
    const { applicationId, resumeVersionId } = olena;
    const query = { applicationId, resumeVersionId, since: daysBefore(1) };
    const lockAs = (userId: string) =>
      testApp.prisma.$transaction((tx) =>
        repository.lockApplication(userId, { applicationId, tx }),
      );

    const asBohdan = await Promise.all([
      repository.findProfile(bohdan.userId, applicationId),
      repository.findLatest(bohdan.userId, query),
      lockAs(bohdan.userId),
    ]);
    const asOlena = await Promise.all([
      repository.findLatest(olena.userId, query),
      lockAs(olena.userId),
    ]);

    expect(asBohdan).toEqual([null, null, null]);
    expect(asOlena).toEqual([
      expect.objectContaining({ id: jobId, status: 'queued' }),
      { runningJobId: jobId },
    ]);
  });
});
