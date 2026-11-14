import { type CaptureRetryResponse, captureRetryResponseSchema } from '@jobflow/shared';

import { apiClient } from '@/shared/api';

export function requestSummary(idempotencyKey: string): Promise<CaptureRetryResponse> {
  return apiClient.request({
    path: '/summaries',
    method: 'POST',
    schema: captureRetryResponseSchema,
    idempotencyKey,
  });
}
