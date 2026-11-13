import { AI_JOB_FAILURES } from '@jobflow/shared';
import type { Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';

import { type AiCompleteJob, queueAiCompletion } from './ai.jobs.js';
import type { AiService } from './ai.service.js';

export type GuardedCompletion = {
  queue: Queue;
  ai: Pick<AiService, 'failJob'>;
  logger: Logger;
};

export async function queueOrFailAiJob(
  { queue, ai, logger }: GuardedCompletion,
  job: AiCompleteJob,
): Promise<void> {
  try {
    await queueAiCompletion(queue, job);
  } catch (error) {
    const errorType = AI_JOB_FAILURES.notReady;
    await ai.failJob(job.userId, { id: job.aiJobId, errorType });
    logger.warn({ aiJobId: job.aiJobId, kind: job.kind, errorType }, `${job.kind} job not queued`);
    throw error;
  }
}
