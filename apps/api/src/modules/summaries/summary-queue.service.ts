import {
  forecastQuerySchema,
  type ForecastResponse,
  type FunnelResponse,
  isActiveStage,
  THRESHOLDS,
} from '@jobflow/shared';
import { Injectable, Logger } from '@nestjs/common';

import { AnalyticsClient, type UserAnalytics } from '../../analytics-client/index.js';
import type { EventDelivery } from '../../outbox/domain-event-router.js';
import {
  AI_PAYLOAD_BUILDERS,
  AiJobQueue,
  type MonthlySummarySource,
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
    private readonly aiQueue: AiJobQueue,
  ) {}

  async enqueue(requested: SummaryRequestedPayload, delivery: EventDelivery): Promise<void> {
    const { userId, aiJobId, requestId, fresh } = requested;
    const buildInput = async () =>
      AI_PAYLOAD_BUILDERS.monthly_summary(await this.sourceOf(requested));
    await this.aiQueue.queueOrFail(
      { aiJobId, userId, kind: 'monthly_summary', requestId, fresh, buildInput },
      delivery,
    );
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
