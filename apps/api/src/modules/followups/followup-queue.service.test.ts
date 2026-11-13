import { buildFollowupInput } from '@jobflow/shared/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { beforeEach, describe, expect, it } from 'vitest';

import { AI_JOB_ID, FakeAiRepository } from '../../test/ai.js';
import { memoryLog } from '../../test/memory-log.js';
import { compileProcessorModule } from '../../test/processor.js';
import { APPLICATION_ID, OLENA_ID } from '../../test/service-fixtures.js';
import { RefusingQueue, SilentQueue, StubQueue } from '../../test/stub-queues.js';
import { AiService } from '../ai/index.js';
import { FollowupQueueService } from './followup-queue.service.js';
import type { FollowupRequestedPayload } from './followups.events.js';

const log = memoryLog();

const REQUESTED: FollowupRequestedPayload = {
  userId: OLENA_ID,
  applicationId: APPLICATION_ID,
  aiJobId: AI_JOB_ID,
  requestId: 'req-1',
  input: buildFollowupInput(),
};

async function serviceWith(queue: StubQueue = new StubQueue('ai')) {
  const ai = new FakeAiRepository();
  ai.queueJob(OLENA_ID);
  const moduleRef = await compileProcessorModule(log.sink, [
    FollowupQueueService,
    { provide: AiService, useValue: ai },
    { provide: getQueueToken('ai'), useValue: queue },
  ]);
  const service = moduleRef.get(FollowupQueueService);
  return { queue, ai, enqueue: (payload = REQUESTED) => service.enqueue(payload) };
}

describe('FollowupQueueService.enqueue', () => {
  beforeEach(() => {
    log.lines.length = 0;
  });

  it('queues the requested followup input under the job id', async () => {
    const { queue, enqueue } = await serviceWith();

    await enqueue();

    expect(queue.jobs).toEqual([
      {
        id: AI_JOB_ID,
        name: 'ai.complete',
        data: {
          aiJobId: AI_JOB_ID,
          userId: OLENA_ID,
          kind: 'followup',
          input: buildFollowupInput(),
          applicationId: APPLICATION_ID,
          requestId: 'req-1',
        },
      },
    ]);
  });

  it('queues a variant fresh at the variant temperature', async () => {
    const { queue, enqueue } = await serviceWith();

    await enqueue({ ...REQUESTED, fresh: true });

    expect(queue.jobs[0]?.data).toEqual(
      expect.objectContaining({ fresh: true, options: { temperature: 0.9 } }),
    );
  });

  it.each([
    { case: 'refuses it', queue: new RefusingQueue('ai'), error: 'Connection is closed.' },
    { case: 'never answers', queue: new SilentQueue('ai'), error: 'timed out after 2000 ms' },
  ])('fails the job as not_ready and rethrows when the queue $case', async ({ queue, error }) => {
    const { ai, enqueue } = await serviceWith(queue);

    await expect(enqueue()).rejects.toThrow(error);

    expect(ai.jobs.get(AI_JOB_ID)).toEqual(
      expect.objectContaining({ status: 'failed', errorType: 'not_ready' }),
    );
  });
});
