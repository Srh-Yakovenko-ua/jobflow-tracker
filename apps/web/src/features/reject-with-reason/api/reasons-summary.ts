import {
  type RejectionReasonsSummary,
  type RejectionReasonsSummaryQuery,
  rejectionReasonsSummarySchema,
} from '@jobflow/shared';

import { apiClient, withSearchParams } from '@/shared/api';

export type ReasonsSummaryRequest = RejectionReasonsSummaryQuery &
  Readonly<{ signal: AbortSignal }>;

export function fetchReasonsSummary({
  stage,
  signal,
}: ReasonsSummaryRequest): Promise<RejectionReasonsSummary> {
  return apiClient.request({
    path: withSearchParams('/applications/reasons-summary', { stage }),
    schema: rejectionReasonsSummarySchema,
    signal,
  });
}
