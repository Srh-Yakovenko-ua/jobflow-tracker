import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

import { AnalyticsClient, AnalyticsServiceError } from '../../analytics-client/index.js';
import { QUEUES } from '../../queues/queues.js';
import {
  AI_PAYLOAD_BUILDERS,
  AiService,
  queueOrFailAiJob,
  type WeakSpotsSource,
} from '../ai/index.js';
import type { InterviewPrepRequestedPayload } from './interview-prep.events.js';

@Injectable()
export class InterviewPrepQueueService {
  private readonly logger = new Logger(InterviewPrepQueueService.name);

  constructor(
    private readonly analytics: AnalyticsClient,
    private readonly ai: AiService,
    @InjectQueue(QUEUES.ai.name) private readonly queue: Queue,
  ) {}

  async enqueue(requested: InterviewPrepRequestedPayload): Promise<void> {
    const { input: vacancy, ...job } = requested;
    const weakSpots = await this.weakSpotsOf(requested);
    const input = AI_PAYLOAD_BUILDERS.interview_prep({ vacancy, weakSpots });
    const guarded = { queue: this.queue, ai: this.ai, logger: this.logger };
    await queueOrFailAiJob(guarded, { kind: 'interview_prep', ...job, input });
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
