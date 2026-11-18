import { CV_HINTS_INPUT } from '@jobflow/shared/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { describe, expect, it } from 'vitest';

import { AI_JOB_ID, FakeAiRepository } from '../../test/ai.js';
import { memoryLog } from '../../test/memory-log.js';
import { compileProcessorModule } from '../../test/processor.js';
import {
  APPLICATION_ID,
  FINAL_DELIVERY,
  FIRST_DELIVERY,
  OLENA_ID,
  RESUME_VERSION_ID,
} from '../../test/service-fixtures.js';
import { RefusingOnceQueue, StubQueue, unreachableQueues } from '../../test/stub-queues.js';
import { AiService } from '../ai/index.js';
import type { CvHintsRequestedPayload } from './cv-hints.events.js';
import { CvHintsQueueService } from './cv-hints-queue.service.js';

const REQUESTED: CvHintsRequestedPayload = {
  userId: OLENA_ID,
  applicationId: APPLICATION_ID,
  resumeVersionId: RESUME_VERSION_ID,
  aiJobId: AI_JOB_ID,
  requestId: 'req-hints-1',
  input: CV_HINTS_INPUT,
};

async function queueing(queue: StubQueue) {
  const ai = new FakeAiRepository();
  ai.queueJob(OLENA_ID);
  const providers = [
    CvHintsQueueService,
    { provide: getQueueToken('ai'), useValue: queue },
    { provide: AiService, useValue: ai },
  ];
  const moduleRef = await compileProcessorModule(memoryLog().sink, providers);
  const service = moduleRef.get(CvHintsQueueService);
  return { ai, enqueue: (delivery = FIRST_DELIVERY) => service.enqueue(REQUESTED, delivery) };
}

const QUEUED_HINTS = {
  id: AI_JOB_ID,
  name: 'ai.complete',
  data: { kind: 'cv_hints', ...REQUESTED },
};

describe('CvHintsQueueService.enqueue', () => {
  it('queues the requested cv_hints input for the linked version under the job id', async () => {
    const queue = new StubQueue('ai');
    await (await queueing(queue)).enqueue();

    expect(queue.jobs).toEqual([QUEUED_HINTS]);
  });

  it('a failed first enqueue of cv hints still runs the job on retry', async () => {
    const queue = new RefusingOnceQueue('ai');
    const { ai, enqueue } = await queueing(queue);

    await expect(enqueue()).rejects.toThrow('Connection is closed.');
    await enqueue();

    expect(queue.jobs).toEqual([QUEUED_HINTS]);
    expect(ai.jobs.get(AI_JOB_ID)).toMatchObject({ status: 'queued' });
  });

  it.each(unreachableQueues('ai'))(
    'marks the job failed with not_ready and rethrows when the queue $case on the final attempt',
    async ({ queue, error }) => {
      const { ai, enqueue } = await queueing(queue);

      await expect(enqueue(FINAL_DELIVERY)).rejects.toThrow(error);

      const { status, errorType } = ai.jobs.get(AI_JOB_ID) ?? {};
      expect([status, errorType]).toEqual(['failed', 'not_ready']);
    },
  );
});
