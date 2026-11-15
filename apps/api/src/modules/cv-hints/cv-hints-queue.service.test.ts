import { CV_HINTS_INPUT } from '@jobflow/shared/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { describe, expect, it } from 'vitest';

import { AI_JOB_ID, FakeAiRepository } from '../../test/ai.js';
import { memoryLog } from '../../test/memory-log.js';
import { compileProcessorModule } from '../../test/processor.js';
import { APPLICATION_ID, OLENA_ID, RESUME_VERSION_ID } from '../../test/service-fixtures.js';
import { StubQueue, unreachableQueues } from '../../test/stub-queues.js';
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
  return { ai, enqueued: moduleRef.get(CvHintsQueueService).enqueue(REQUESTED) };
}

describe('CvHintsQueueService.enqueue', () => {
  it('queues the requested cv_hints input for the linked version under the job id', async () => {
    const queue = new StubQueue('ai');
    await (
      await queueing(queue)
    ).enqueued;

    expect(queue.jobs).toEqual([
      {
        id: AI_JOB_ID,
        name: 'ai.complete',
        data: { kind: 'cv_hints', ...REQUESTED },
      },
    ]);
  });

  it.each(unreachableQueues('ai'))(
    'marks the job failed with not_ready and rethrows when the queue $case',
    async ({ queue, error }) => {
      const { ai, enqueued } = await queueing(queue);

      await expect(enqueued).rejects.toThrow(error);

      const { status, errorType } = ai.jobs.get(AI_JOB_ID) ?? {};
      expect([status, errorType]).toEqual(['failed', 'not_ready']);
    },
  );
});
