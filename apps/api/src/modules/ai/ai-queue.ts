import { AI_JOB_FAILURES } from '@jobflow/shared';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

import { QUEUES } from '../../queues/queues.js';
import { type AiCompleteJob, queueAiCompletion } from './ai.jobs.js';
import { AiService } from './ai.service.js';

export type AiJobBuilder = Omit<AiCompleteJob, 'input'> & { buildInput: () => unknown };

export type AiQueueAttempt = { finalAttempt: boolean; eventId?: string };

@Injectable()
export class AiJobQueue {
  private readonly logger = new Logger(AiJobQueue.name);

  constructor(
    private readonly ai: AiService,
    @InjectQueue(QUEUES.ai.name) private readonly queue: Queue,
  ) {}

  async queueOrFail(
    { buildInput, ...head }: AiJobBuilder,
    { finalAttempt, eventId }: AiQueueAttempt,
  ): Promise<void> {
    try {
      await queueAiCompletion(this.queue, { ...head, input: await buildInput() });
    } catch (error) {
      if (!finalAttempt) {
        throw error;
      }
      const { aiJobId, kind } = head;
      const errorType = AI_JOB_FAILURES.notReady;
      await this.ai.failJob(head.userId, { id: aiJobId, errorType });
      this.logger.warn({ eventId, aiJobId, kind, errorType }, `${kind} job not queued`);
      throw error;
    }
  }
}
