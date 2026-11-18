import { FOLLOWUP_LIMITS } from '@jobflow/shared';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

import type { EventDelivery } from '../../outbox/domain-event-router.js';
import { QUEUES } from '../../queues/queues.js';
import { type AiJobBuilder, AiService, queueOrFailAiJob } from '../ai/index.js';
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

  async enqueue(
    { fresh, input, ...requested }: FollowupRequestedPayload,
    { finalAttempt }: EventDelivery,
  ): Promise<void> {
    const job: AiJobBuilder = {
      kind: 'followup',
      ...requested,
      ...(fresh && VARIANT),
      buildInput: () => input,
    };
    const guarded = { queue: this.queue, ai: this.ai, logger: this.logger, finalAttempt };
    await queueOrFailAiJob(guarded, job);
    const { aiJobId, applicationId, requestId } = requested;
    this.logger.log({ requestId, aiJobId, applicationId }, 'followup queued');
  }
}
