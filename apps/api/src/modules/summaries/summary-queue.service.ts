import {
  AI_JOB_FAILURES,
  forecastQuerySchema,
  type ForecastResponse,
  type FunnelResponse,
  isActiveStage,
  THRESHOLDS,
} from '@jobflow/shared';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

import { AnalyticsClient, type UserAnalytics } from '../../analytics-client/index.js';
import type { EventDelivery } from '../../outbox/domain-event-router.js';
import { QUEUES } from '../../queues/queues.js';
import {
  AI_PAYLOAD_BUILDERS,
  type AiCompleteJob,
  AiService,
  type MonthlySummarySource,
  queueAiCompletion,
  type WhatIfSource,
} from '../ai/index.js';
import { PlansService } from '../plans/index.js';
import type { SummaryRequestedPayload } from './summaries.events.js';

const improveSchema = forecastQuerySchema.shape.improve.unwrap();

type WhatIfQuery = { searchId: string; funnel: FunnelResponse; forecast: ForecastResponse };

async function whatIfOf(
  analytics: UserAnalytics,
  { searchId, funnel, forecast }: WhatIfQuery,
): Promise<WhatIfSource | null> {
  const costliest = funnel.mostExpensive;
  if (costliest?.status !== 'ok' || forecast.status !== 'ok' || !isActiveStage(costliest.stage)) {
    return null;
  }
  if (costliest.passed / costliest.reached >= THRESHOLDS.WHAT_IF_CONVERSION) {
    return null;
  }
  const { stage } = costliest;
  const improve = improveSchema.parse(`${stage}:${String(THRESHOLDS.WHAT_IF_CONVERSION)}`);
  return { stage, forecast: await analytics.forecast({ searchId, improve }) };
}

@Injectable()
export class SummaryQueueService {
  private readonly logger = new Logger(SummaryQueueService.name);

  constructor(
    private readonly analytics: AnalyticsClient,
    private readonly plans: PlansService,
    private readonly ai: AiService,
    @InjectQueue(QUEUES.ai.name) private readonly queue: Queue,
  ) {}

  async enqueue(requested: SummaryRequestedPayload, delivery: EventDelivery): Promise<void> {
    const { userId, aiJobId, requestId, fresh } = requested;
    try {
      const input = AI_PAYLOAD_BUILDERS.monthly_summary(await this.sourceOf(requested));
      const job: AiCompleteJob = {
        aiJobId,
        userId,
        kind: 'monthly_summary',
        input,
        requestId,
        fresh,
      };
      await queueAiCompletion(this.queue, job);
    } catch (error) {
      if (delivery.finalAttempt) {
        await this.ai.failJob(userId, { id: aiJobId, errorType: AI_JOB_FAILURES.notReady });
        this.logger.warn({ eventId: delivery.eventId, aiJobId }, 'monthly summary failed');
      }
      throw error;
    }
    this.logger.log({ requestId, aiJobId, month: requested.month }, 'monthly summary queued');
  }

  private async sourceOf(requested: SummaryRequestedPayload): Promise<MonthlySummarySource> {
    const { userId, searchId, month, requestId } = requested;
    const analytics = this.analytics.forUser(userId, requestId);
    const [funnel, forecast, reasons, sources, resumeAb, insights, previousPlan] =
      await Promise.all([
        analytics.funnel({ searchId, month }),
        analytics.forecast({ searchId }),
        analytics.reasons({ searchId }),
        analytics.sources({ searchId }),
        analytics.resumeAb(),
        analytics.insights({ searchId }),
        this.plans.progress(userId, month),
      ]);
    const whatIf = await whatIfOf(analytics, { searchId, funnel, forecast });
    return { month, funnel, forecast, whatIf, reasons, sources, resumeAb, insights, previousPlan };
  }
}
