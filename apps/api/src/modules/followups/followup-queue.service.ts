import { FOLLOWUP_LIMITS } from '@jobflow/shared';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

import { QUEUES } from '../../queues/queues.js';
import { type AiCompleteJob, AiService, queueOrFailAiJob } from '../ai/index.js';
import type { FollowupRequestedPayload } from './followups.events.js';

const VARIANT = {
  fresh: true,
  options: { temperature: FOLLOWUP_LIMITS.variantTemperature },
} as const;

@Injectable()
export class FollowupQueueService {
  private readonly logger = new Logger(FollowupQueueService.name);

  constructor(
    private readonly ai: AiService,
    @InjectQueue(QUEUES.ai.name) private readonly queue: Queue,
  ) {}

  async enqueue({ fresh, ...requested }: FollowupRequestedPayload): Promise<void> {
    const job: AiCompleteJob = { kind: 'followup', ...requested, ...(fresh && VARIANT) };
    await queueOrFailAiJob({ queue: this.queue, ai: this.ai, logger: this.logger }, job);
    const { aiJobId, applicationId, requestId } = requested;
    this.logger.log({ requestId, aiJobId, applicationId }, 'followup queued');
  }
}
