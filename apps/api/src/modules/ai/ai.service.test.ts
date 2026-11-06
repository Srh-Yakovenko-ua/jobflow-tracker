import { ConfigService } from '@nestjs/config';
import { UnrecoverableError } from 'bullmq';
import { beforeEach, describe, expect, it } from 'vitest';

import { Clock } from '../../common/clock.js';
import { validateEnv } from '../../config/env.js';
import {
  AI_JOB_ID,
  FakeAiClient,
  type FakeAiJob,
  FakeAiRepository,
  VACANCY_CALL,
  VACANCY_COMPLETION,
  VACANCY_JOB,
  VACANCY_TEXT,
} from '../../test/ai.js';
import { exampleEnv } from '../../test/example-env.js';
import { memoryLog } from '../../test/memory-log.js';
import { compileProcessorModule } from '../../test/processor.js';
import { BOHDAN_ID, OLENA_ID } from '../../test/service-fixtures.js';
import { NOW } from '../../test/time.js';
import type { AiCompleteJob } from './ai.jobs.js';
import { AiRepository } from './ai.repository.js';
import { type AiCompleteAttempt, AiService } from './ai.service.js';
import { AiClient } from './ai-client.js';
import { AiServiceError } from './ai-service-error.js';

const log = memoryLog();

const BUDGET = { AI_DAILY_LIMIT: '3', AI_MONTHLY_TOKEN_CAP: '5000' };

const PASTED_AGAIN_JOB_ID = '0199f0a0-0000-7000-8000-000000000202';

const NOT_READY = new AiServiceError({ status: 503, type: 'not_ready' });

type AttemptOptions = { job?: AiCompleteJob; finalAttempt?: boolean };

function attemptOf({
  job = VACANCY_JOB,
  finalAttempt = false,
}: AttemptOptions = {}): AiCompleteAttempt {
  return {
    job,
    finalAttempt,
    logFields: { jobId: job.aiJobId, queue: 'ai', jobName: 'ai.complete' },
  };
}

async function serviceWithFakes() {
  const repository = new FakeAiRepository();
  const ai = new FakeAiClient();
  const config = new ConfigService(validateEnv({ ...exampleEnv, ...BUDGET }));
  const moduleRef = await compileProcessorModule(log.sink, [
    AiService,
    { provide: AiRepository, useValue: repository },
    { provide: AiClient, useValue: ai },
    { provide: Clock, useValue: { now: () => NOW } },
    { provide: ConfigService, useValue: config },
  ]);
  repository.queueJob(OLENA_ID);
  return { repository, ai, service: moduleRef.get(AiService) };
}

const failedJob = (errorType: string): FakeAiJob => ({
  userId: OLENA_ID,
  status: 'failed',
  errorType,
  finishedAt: NOW,
});

beforeEach(() => {
  log.lines.length = 0;
});

describe('AiService.complete', () => {
  it('calls services/ai once on a cache miss, stores the succeeded result and finishes the job with it', async () => {
    const { repository, ai, service } = await serviceWithFakes();

    await expect(service.complete(attemptOf())).resolves.toEqual({
      aiResultId: 'ai-result-1',
      output: VACANCY_COMPLETION.output,
      cached: false,
    });

    expect(ai.calls).toEqual([VACANCY_CALL]);
    expect([...repository.results.values()]).toEqual([
      expect.objectContaining({
        id: 'ai-result-1',
        userId: OLENA_ID,
        status: 'succeeded',
        error: null,
        output: VACANCY_COMPLETION.output,
        model: 'fake',
        promptVersion: 'v1',
        tokensIn: 120,
        tokensOut: 40,
        latencyMs: 15,
      }),
    ]);
    expect(repository.jobs.get(AI_JOB_ID)).toEqual({
      userId: OLENA_ID,
      status: 'done',
      aiResultId: 'ai-result-1',
      finishedAt: NOW,
    });
  });

  it('counts the daily calls from 00:00 UTC and the monthly tokens from the 1st of the UTC month', async () => {
    const { repository, service } = await serviceWithFakes();

    await service.complete(attemptOf());

    expect(repository.budgetQueries).toEqual([
      {
        userId: OLENA_ID,
        dayStart: new Date('2026-10-22T00:00:00.000Z'),
        monthStart: new Date('2026-10-01T00:00:00.000Z'),
      },
    ]);
  });

  it('serves the same vacancy pasted again with other whitespace from the cache, over budget and without a call', async () => {
    const { repository, ai, service } = await serviceWithFakes();
    await service.complete(attemptOf());
    repository.queueJob(OLENA_ID, PASTED_AGAIN_JOB_ID);
    repository.usage = { calls: 3, tokens: 5000 };
    const pastedAgain = {
      ...VACANCY_JOB,
      aiJobId: PASTED_AGAIN_JOB_ID,
      input: { text: `\n  ${VACANCY_TEXT.replaceAll(' ', '   ')}  \n` },
    };

    await expect(service.complete(attemptOf({ job: pastedAgain }))).resolves.toEqual({
      aiResultId: 'ai-result-1',
      output: VACANCY_COMPLETION.output,
      cached: true,
    });

    expect(ai.calls).toEqual([VACANCY_CALL]);
    expect(repository.budgetQueries).toHaveLength(1);
    expect(repository.jobs.get(PASTED_AGAIN_JOB_ID)).toEqual({
      userId: OLENA_ID,
      status: 'done',
      aiResultId: 'ai-result-1',
      finishedAt: NOW,
    });
    expect(log.parsed()).toContainEqual(
      expect.objectContaining({ msg: 'ai cache hit', aiJobId: PASTED_AGAIN_JOB_ID }),
    );
  });

  it("asks services/ai again for another user's identical vacancy", async () => {
    const { repository, ai, service } = await serviceWithFakes();
    await service.complete(attemptOf());
    repository.queueJob(BOHDAN_ID, PASTED_AGAIN_JOB_ID);

    const outcome = await service.complete(
      attemptOf({ job: { ...VACANCY_JOB, aiJobId: PASTED_AGAIN_JOB_ID, userId: BOHDAN_ID } }),
    );

    expect(outcome).toEqual(expect.objectContaining({ aiResultId: 'ai-result-2', cached: false }));
    expect(ai.calls).toEqual([VACANCY_CALL, VACANCY_CALL]);
  });

  it.each([
    { reached: 'the daily call limit', usage: { calls: 3, tokens: 0 } },
    { reached: 'the monthly token cap', usage: { calls: 0, tokens: 5000 } },
  ])(
    'refuses a call once $reached is reached with budget_exceeded, fails the job and calls nothing',
    async ({ usage }) => {
      const { repository, ai, service } = await serviceWithFakes();
      repository.usage = usage;

      const error = await service.complete(attemptOf()).catch((thrown: unknown) => thrown);

      expect(error).toBeInstanceOf(UnrecoverableError);
      expect(error).toHaveProperty('message', 'budget_exceeded');
      expect(ai.calls).toEqual([]);
      expect(repository.results.size).toBe(0);
      expect(repository.jobs.get(AI_JOB_ID)).toEqual(failedJob('budget_exceeded'));
      expect(log.parsed()).toContainEqual(
        expect.objectContaining({ level: 40, msg: 'ai budget exceeded', aiJobId: AI_JOB_ID }),
      );
    },
  );

  it('still calls services/ai one call and one token below the budget', async () => {
    const { repository, ai, service } = await serviceWithFakes();
    repository.usage = { calls: 2, tokens: 4999 };

    await expect(service.complete(attemptOf())).resolves.toHaveProperty('cached', false);
    expect(ai.calls).toEqual([VACANCY_CALL]);
  });

  it('records a 422 from services/ai as a failed result, fails the job and gives up without a retry', async () => {
    const { repository, ai, service } = await serviceWithFakes();
    ai.answer = () =>
      Promise.reject(new AiServiceError({ status: 422, type: 'ai_invalid_output' }));

    await expect(service.complete(attemptOf())).rejects.toBeInstanceOf(UnrecoverableError);

    expect([...repository.results.values()]).toEqual([
      expect.objectContaining({
        id: 'ai-result-1',
        userId: OLENA_ID,
        kind: 'vacancy_parse',
        status: 'failed',
        error: 'ai_invalid_output',
        model: '',
        promptVersion: 'v1',
        tokensIn: 0,
        tokensOut: 0,
        latencyMs: 0,
      }),
    ]);
    expect(repository.jobs.get(AI_JOB_ID)).toEqual(failedJob('ai_invalid_output'));
  });

  it('rethrows a 503 before the last attempt so BullMQ retries it, writing nothing', async () => {
    const { repository, ai, service } = await serviceWithFakes();
    ai.answer = () => Promise.reject(NOT_READY);

    await expect(service.complete(attemptOf())).rejects.toBe(NOT_READY);

    expect(repository.results.size).toBe(0);
    expect(repository.jobs.get(AI_JOB_ID)).toEqual({ userId: OLENA_ID, status: 'processing' });
  });

  it('fails the job with not_ready when a 503 comes on the last attempt and rethrows it', async () => {
    const { repository, ai, service } = await serviceWithFakes();
    ai.answer = () => Promise.reject(NOT_READY);

    await expect(service.complete(attemptOf({ finalAttempt: true }))).rejects.toBe(NOT_READY);

    expect([...repository.results.values()]).toEqual([
      expect.objectContaining({ status: 'failed', error: 'not_ready', tokensIn: 0, tokensOut: 0 }),
    ]);
    expect(repository.jobs.get(AI_JOB_ID)).toEqual(failedJob('not_ready'));
  });

  it('rethrows a refused Postgres connection untouched and never calls services/ai', async () => {
    const { repository, ai, service } = await serviceWithFakes();
    const refused = new Error('connect ECONNREFUSED 127.0.0.1:5432');
    repository.refusal = refused;

    await expect(service.complete(attemptOf({ finalAttempt: true }))).rejects.toBe(refused);

    expect(ai.calls).toEqual([]);
  });

  it.each<{ job: string; stored: FakeAiJob[] }>([
    { job: 'gone since it was enqueued', stored: [] },
    { job: 'already done', stored: [{ userId: OLENA_ID, status: 'done' }] },
    { job: 'already failed', stored: [{ userId: OLENA_ID, status: 'failed' }] },
    { job: "another user's", stored: [{ userId: BOHDAN_ID, status: 'queued' }] },
  ])('skips a job that is $job without calling services/ai', async ({ stored }) => {
    const { repository, ai, service } = await serviceWithFakes();
    repository.jobs.clear();
    for (const job of stored) {
      repository.jobs.set(AI_JOB_ID, job);
    }

    await expect(service.complete(attemptOf())).resolves.toBeNull();

    expect(ai.calls).toEqual([]);
    expect(log.parsed()).toEqual([
      expect.objectContaining({ msg: 'ai job skipped', aiJobId: AI_JOB_ID, requestId: 'req-ai-7' }),
    ]);
  });
});

describe('AiService.queuePosition', () => {
  const JOB_OF_OLENA = { userId: OLENA_ID, aiJobId: AI_JOB_ID };

  it.each([
    { line: 'first in line', queue: { ahead: 0, latencies: [12_000, 18_000] }, etaSeconds: 15 },
    { line: 'behind three jobs', queue: { ahead: 3, latencies: [12_000, 18_000] }, etaSeconds: 30 },
    {
      line: 'behind three jobs with no latency history',
      queue: { ahead: 3, latencies: [] },
      etaSeconds: 20,
    },
  ])(
    'estimates a job $line two at a time from the average latency',
    async ({ queue, etaSeconds }) => {
      const { repository, service } = await serviceWithFakes();
      repository.queue = queue;

      await expect(service.queuePosition(JOB_OF_OLENA)).resolves.toEqual({
        ahead: queue.ahead,
        etaSeconds,
      });
    },
  );

  it("answers null for another user's job and for a job no longer queued", async () => {
    const { repository, service } = await serviceWithFakes();

    const ofBohdan = await service.queuePosition({ userId: BOHDAN_ID, aiJobId: AI_JOB_ID });
    repository.jobs.set(AI_JOB_ID, { userId: OLENA_ID, status: 'processing' });
    const processing = await service.queuePosition(JOB_OF_OLENA);

    expect([ofBohdan, processing]).toEqual([null, null]);
  });
});
