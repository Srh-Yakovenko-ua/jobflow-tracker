import { FOLLOWUP_LIMITS } from '@jobflow/shared';
import { Injectable, Logger } from '@nestjs/common';

import type { EventDelivery } from '../../outbox/domain-event-router.js';
import { type AiJobBuilder, AiJobQueue } from '../ai/index.js';
import type { FollowupRequestedPayload } from './followups.events.js';

const VARIANT = {
  fresh: true,
  options: { temperature: FOLLOWUP_LIMITS.variantTemperature },
} as const;

@Injectable()
export class FollowupQueueService {
  private readonly logger = new Logger(FollowupQueueService.name);

  constructor(private readonly aiQueue: AiJobQueue) {}

  async enqueue(
    { fresh, input, ...requested }: FollowupRequestedPayload,
    delivery: EventDelivery,
  ): Promise<void> {
    const job: AiJobBuilder = {
      kind: 'followup',
      ...requested,
      ...(fresh && VARIANT),
      buildInput: () => input,
    };
    await this.aiQueue.queueOrFail(job, delivery);
    const { aiJobId, applicationId, requestId } = requested;
    this.logger.log({ requestId, aiJobId, applicationId }, 'followup queued');
  }
}
