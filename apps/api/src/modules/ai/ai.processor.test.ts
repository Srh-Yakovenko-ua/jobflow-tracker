import type { TestingModule } from '@nestjs/testing';
import { UnrecoverableError } from 'bullmq';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { Clock } from '../../common/clock.js';
import {
  AI_JOB_ID,
  FakeAiClient,
  FakeAiRepository,
  SettledAiJobs,
  VACANCY_CALL,
  VACANCY_COMPLETION,
  VACANCY_JOB,
} from '../../test/ai.js';
import { memoryLog } from '../../test/memory-log.js';
import { processedJob } from '../../test/processed-job.js';
import { compileProcessorModule } from '../../test/processor.js';
import { APPLICATION_ID, OLENA_ID } from '../../test/service-fixtures.js';
import { AiProcessor } from './ai.processor.js';
import { AiRepository } from './ai.repository.js';
import { AiService } from './ai.service.js';
import { AiClient } from './ai-client.js';
import { AiJobRouter } from './ai-job-router.js';
import { AiServiceError } from './ai-service-error.js';

const log = memoryLog();

const settledJobs = new SettledAiJobs();

function aiJob(data: unknown, name = 'ai.complete') {
  return processedJob({ queueName: 'ai', name, data, id: '71' });
}

describe('AiProcessor', () => {
  const ai = new FakeAiClient();
  const repository = new FakeAiRepository();
  let moduleRef: TestingModule;
  let processor: AiProcessor;

  beforeAll(async () => {
    moduleRef = await compileProcessorModule(log.sink, [
      AiProcessor,
      AiService,
      AiJobRouter,
      Clock,
      { provide: AiClient, useValue: ai },
      { provide: AiRepository, useValue: repository },
    ]);
    processor = moduleRef.get(AiProcessor);
    moduleRef.get(AiJobRouter).subscribe('vacancy_parse', settledJobs.record);
  });

  beforeEach(() => {
    log.lines.length = 0;
    settledJobs.outcomes.length = 0;
    ai.calls.length = 0;
    ai.answer = () => Promise.resolve(VACANCY_COMPLETION);
    repository.jobs.clear();
    repository.results.clear();
    repository.queueJob(OLENA_ID);
  });

  afterAll(() => moduleRef.close());

  it('completes an ai.complete job through the service and logs its kind, model, prompt version, tokens and latency', async () => {
    await expect(processor.process(aiJob(VACANCY_JOB))).resolves.toEqual({
      aiResultId: 'ai-result-1',
      output: VACANCY_COMPLETION.output,
      cached: false,
    });

    expect(ai.calls).toEqual([VACANCY_CALL]);
    expect(log.parsed()).toEqual([
      expect.objectContaining({
        msg: 'ai completion done',
        requestId: 'req-ai-7',
        jobId: '71',
        kind: 'vacancy_parse',
        model: 'fake',
        promptVersion: 'v2',
        tokensIn: 120,
        tokensOut: 40,
        latencyMs: 15,
      }),
    ]);
    expect(log.lines.join('')).not.toContain('Acme');
  });

  it('routes the settled job with its application id to the subscribers of its kind', async () => {
    const job = { ...VACANCY_JOB, applicationId: APPLICATION_ID };

    await processor.process(aiJob(job));

    expect(settledJobs.outcomes).toEqual([
      { job, status: 'done', output: VACANCY_COMPLETION.output },
    ]);
  });

  it('fails the job as unrecoverable when services/ai refuses it with 422', async () => {
    ai.answer = () =>
      Promise.reject(new AiServiceError({ status: 422, type: 'ai_invalid_output' }));

    await expect(processor.process(aiJob(VACANCY_JOB))).rejects.toBeInstanceOf(UnrecoverableError);
  });

  it.each([
    { status: 429, type: 'rate_limited' },
    { status: 504, type: 'ai_timeout' },
    { status: 503, type: 'not_ready' },
  ])('rethrows a $status $type so BullMQ retries it with backoff', async (failure) => {
    const refusal = new AiServiceError(failure);
    ai.answer = () => Promise.reject(refusal);

    const error = await processor.process(aiJob(VACANCY_JOB)).catch((thrown: unknown) => thrown);

    expect(error).toBe(refusal);
    expect(error).not.toBeInstanceOf(UnrecoverableError);
  });

  it('fails the ai job with the error type when a 503 comes on the third and last attempt', async () => {
    ai.answer = () => Promise.reject(new AiServiceError({ status: 503, type: 'not_ready' }));

    await expect(
      processor.process({ ...aiJob(VACANCY_JOB), attemptsMade: 2 }),
    ).rejects.toBeInstanceOf(AiServiceError);

    expect(repository.jobs.get(AI_JOB_ID)).toEqual(
      expect.objectContaining({ status: 'failed', errorType: 'not_ready' }),
    );
  });

  it.each([
    { job: 'with an unknown name', data: VACANCY_JOB, name: 'ai.summarize' },
    { job: 'of an unknown kind', data: { ...VACANCY_JOB, kind: 'resume_parse' }, name: undefined },
    { job: 'without data', data: undefined, name: undefined },
  ])('fails a job $job as unrecoverable and calls nothing', async ({ data, name }) => {
    await expect(processor.process(aiJob(data, name))).rejects.toBeInstanceOf(UnrecoverableError);

    expect(ai.calls).toEqual([]);
    expect(log.parsed()).toEqual([
      expect.objectContaining({ level: 50, msg: 'ai job invalid', jobId: '71' }),
    ]);
  });

  it('logs the ai job id, kind and request id of a failed job', () => {
    processor.onFailed(aiJob(VACANCY_JOB), new Error('AI call failed: 503 not_ready'));

    expect(log.parsed()).toEqual([
      expect.objectContaining({
        level: 40,
        msg: 'ai job failed',
        aiJobId: AI_JOB_ID,
        kind: 'vacancy_parse',
        requestId: 'req-ai-7',
      }),
    ]);
  });
});
