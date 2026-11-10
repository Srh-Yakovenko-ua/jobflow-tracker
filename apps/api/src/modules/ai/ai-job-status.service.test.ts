import { jobStatusSchema } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { Clock } from '../../common/clock.js';
import { AI_JOB_ID, FakeAiClient, type FakeAiJob, FakeAiRepository } from '../../test/ai.js';
import { memoryLog } from '../../test/memory-log.js';
import { compileProcessorModule } from '../../test/processor.js';
import { APPLICATION_ID, BOHDAN_ID, MISSING_ID, OLENA_ID } from '../../test/service-fixtures.js';
import { AiRepository } from './ai.repository.js';
import { AiService } from './ai.service.js';
import { AiClient } from './ai-client.js';
import { AiJobStatusService } from './ai-job-status.service.js';

const STATUS = {
  id: AI_JOB_ID,
  kind: 'vacancy_parse',
  totalSteps: 3,
  queue: null,
  errorType: null,
  applicationId: APPLICATION_ID,
};

const NOT_FOUND = { status: 404, body: { status: 404, type: 'not_found', title: 'Not found' } };

async function statusOf(job: FakeAiJob) {
  const repository = new FakeAiRepository();
  const moduleRef = await compileProcessorModule(memoryLog().sink, [
    AiJobStatusService,
    AiService,
    Clock,
    { provide: AiClient, useValue: new FakeAiClient() },
    { provide: AiRepository, useValue: repository },
  ]);
  repository.jobs.set(AI_JOB_ID, { applicationId: APPLICATION_ID, ...job });
  repository.queue = { ahead: 2, latencies: [] };
  return moduleRef.get(AiJobStatusService);
}

describe('AiJobStatusService.find', () => {
  it('answers a queued job at step 1 of 3 with the jobs ahead of it and the estimate', async () => {
    const service = await statusOf({ userId: OLENA_ID, status: 'queued', step: 1 });

    const status = await service.find(OLENA_ID, AI_JOB_ID);

    expect(jobStatusSchema.parse(status)).toEqual({
      ...STATUS,
      status: 'queued',
      step: 1,
      queue: { ahead: 2, etaSeconds: 20 },
    });
  });

  it.each([
    { status: 'processing', step: 2 },
    { status: 'done', step: 3 },
  ] as const)('answers a $status job at step $step without a queue position', async (job) => {
    const service = await statusOf({ userId: OLENA_ID, ...job });

    await expect(service.find(OLENA_ID, AI_JOB_ID)).resolves.toEqual({ ...STATUS, ...job });
  });

  it('answers a failed job with its error type at the step it had reached', async () => {
    const failed = { status: 'failed', step: 2, errorType: 'budget_exceeded' } as const;
    const service = await statusOf({ userId: OLENA_ID, ...failed });

    await expect(service.find(OLENA_ID, AI_JOB_ID)).resolves.toEqual({ ...STATUS, ...failed });
  });

  it('answers step 0 for a job stored before steps were written', async () => {
    const service = await statusOf({ userId: OLENA_ID, status: 'done' });

    await expect(service.find(OLENA_ID, AI_JOB_ID)).resolves.toHaveProperty('step', 0);
  });

  it.each([
    { job: "another user's job", userId: BOHDAN_ID, id: AI_JOB_ID },
    { job: 'a job that does not exist', userId: OLENA_ID, id: MISSING_ID },
  ])('refuses $job as not found', async ({ userId, id }) => {
    const service = await statusOf({ userId: OLENA_ID, status: 'queued', step: 1 });

    await expect(service.find(userId, id)).rejects.toMatchObject(NOT_FOUND);
  });
});
