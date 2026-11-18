import { AI_JOB_FAILURES } from '@jobflow/shared';
import type { Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';

import { type AiCompleteJob, queueAiCompletion } from './ai.jobs.js';
import type { AiService } from './ai.service.js';

export type GuardedCompletion = {
  queue: Queue;
  ai: Pick<AiService, 'failJob'>;
  logger: Logger;
  finalAttempt: boolean;
};

export type AiJobBuilder = Omit<AiCompleteJob, 'input'> & { buildInput: () => unknown };

export async function queueOrFailAiJob(
  { queue, ai, logger, finalAttempt }: GuardedCompletion,
  { buildInput, ...head }: AiJobBuilder,
): Promise<void> {
  try {
    await queueAiCompletion(queue, { ...head, input: await buildInput() });
  } catch (error) {
    if (!finalAttempt) {
      throw error;
    }
    const errorType = AI_JOB_FAILURES.notReady;
    await ai.failJob(head.userId, { id: head.aiJobId, errorType });
    logger.warn(
      { aiJobId: head.aiJobId, kind: head.kind, errorType },
      `${head.kind} job not queued`,
    );
    throw error;
  }
}
