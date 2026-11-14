import { type Plan, planSchema, type Summary } from '@jobflow/shared';

import { apiClient } from '@/shared/api';

export type SaveSummaryPlanRequest = Readonly<{
  aiJobId: Summary['aiJobId'];
  idempotencyKey: string;
}>;

export function saveSummaryPlan({
  aiJobId,
  idempotencyKey,
}: SaveSummaryPlanRequest): Promise<Plan> {
  return apiClient.request({
    path: `/summaries/${aiJobId}/plan`,
    method: 'POST',
    schema: planSchema,
    idempotencyKey,
  });
}
