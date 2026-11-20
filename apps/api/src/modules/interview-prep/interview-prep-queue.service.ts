import { Injectable, Logger } from '@nestjs/common';

import { AnalyticsClient, AnalyticsServiceError } from '../../analytics-client/index.js';
import type { EventDelivery } from '../../outbox/domain-event-router.js';
import { AI_PAYLOAD_BUILDERS, AiJobQueue, type WeakSpotsSource } from '../ai/index.js';
import type { InterviewPrepRequestedPayload } from './interview-prep.events.js';

@Injectable()
export class InterviewPrepQueueService {
  private readonly logger = new Logger(InterviewPrepQueueService.name);

  constructor(
    private readonly analytics: AnalyticsClient,
    private readonly aiQueue: AiJobQueue,
  ) {}

  async enqueue(requested: InterviewPrepRequestedPayload, delivery: EventDelivery): Promise<void> {
    const { input: vacancy, ...job } = requested;
    const buildInput = async () =>
      AI_PAYLOAD_BUILDERS.interview_prep({ vacancy, weakSpots: await this.weakSpotsOf(requested) });
    await this.aiQueue.queueOrFail({ kind: 'interview_prep', ...job, buildInput }, delivery);
    const { aiJobId, applicationId, requestId } = requested;
    this.logger.log({ requestId, aiJobId, applicationId }, 'interview prep queued');
  }

  private async weakSpotsOf({
    userId,
    aiJobId,
    requestId,
  }: InterviewPrepRequestedPayload): Promise<WeakSpotsSource | null> {
    const analytics = this.analytics.forUser(userId, requestId);
    try {
      const [reasons, insights] = await Promise.all([
        analytics.reasons({}),
        analytics.insights({}),
      ]);
      return { reasons, insights };
    } catch (error) {
      if (!(error instanceof AnalyticsServiceError)) {
        throw error;
      }
      const errorType = error.type;
      this.logger.warn({ requestId, aiJobId, errorType }, 'interview prep without weak spots');
      return null;
    }
  }
}
