import type { AiCompletion, AiKind } from '@jobflow/shared';
import type { TestingModule } from '@nestjs/testing';
import { UnrecoverableError } from 'bullmq';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { VACANCY_COMPLETION, VACANCY_TEXT } from '../../test/ai.js';
import { memoryLog } from '../../test/memory-log.js';
import { processedJob } from '../../test/processed-job.js';
import { compileProcessorModule } from '../../test/processor.js';
import { AiProcessor } from './ai.processor.js';
import { AiClient, type AiCompleteCall } from './ai-client.js';
import { AiServiceError } from './ai-service-error.js';

const log = memoryLog();

const VACANCY_JOB = {
  kind: 'vacancy_parse',
  input: { text: VACANCY_TEXT },
  requestId: 'req-ai-7',
};

class FakeAiClient {
  readonly calls: AiCompleteCall[] = [];

  answer: () => Promise<AiCompletion<AiKind>> = () => Promise.resolve(VACANCY_COMPLETION);

  complete(call: AiCompleteCall): Promise<AiCompletion<AiKind>> {
    this.calls.push(call);
    return this.answer();
  }
}

function aiJob(data: unknown, name = 'ai.complete') {
  return processedJob({ queueName: 'ai', name, data, id: '71' });
}

describe('AiProcessor', () => {
  const ai = new FakeAiClient();
  let moduleRef: TestingModule;
  let processor: AiProcessor;

  beforeAll(async () => {
    moduleRef = await compileProcessorModule(log.sink, [
      AiProcessor,
      { provide: AiClient, useValue: ai },
    ]);
    processor = moduleRef.get(AiProcessor);
  });

  beforeEach(() => {
    log.lines.length = 0;
    ai.calls.length = 0;
    ai.answer = () => Promise.resolve(VACANCY_COMPLETION);
  });

  afterAll(() => moduleRef.close());

  it('returns the completion of an ai.complete job and logs its kind, model, prompt version, tokens and latency', async () => {
    await expect(processor.process(aiJob(VACANCY_JOB))).resolves.toEqual(VACANCY_COMPLETION);

    expect(ai.calls).toEqual([VACANCY_JOB]);
    expect(log.parsed()).toEqual([
      expect.objectContaining({
        msg: 'ai completion done',
        requestId: 'req-ai-7',
        jobId: '71',
        kind: 'vacancy_parse',
        model: 'fake',
        promptVersion: 'v1',
        tokensIn: 120,
        tokensOut: 40,
        latencyMs: 15,
      }),
    ]);
    expect(log.lines.join('')).not.toContain('Acme');
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
});
