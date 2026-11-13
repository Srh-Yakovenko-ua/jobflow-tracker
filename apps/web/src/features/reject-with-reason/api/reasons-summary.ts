import {
  type RejectionReasonsSummary,
  type RejectionReasonsSummaryQuery,
  rejectionReasonsSummarySchema,
} from '@jobflow/shared';

import { analyticsClient, apiClient, withSearchParams } from '@/shared/api';

export type ReasonsSummaryRequest = RejectionReasonsSummaryQuery &
  Readonly<{ signal: AbortSignal }>;

export async function fetchReasonsSummary({
  stage,
  signal,
}: ReasonsSummaryRequest): Promise<RejectionReasonsSummary> {
  const request = { schema: rejectionReasonsSummarySchema, signal };
  try {
    return await analyticsClient.request({
      ...request,
      path: withSearchParams('/analytics/reasons/summary', { stage }),
    });
  } catch (error) {
    if (signal.aborted) {
      throw error;
    }
    return apiClient.request({
      ...request,
      path: withSearchParams('/applications/reasons-summary', { stage }),
    });
  }
}
