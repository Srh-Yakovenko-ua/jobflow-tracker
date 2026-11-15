import {
  type ApplicationResponse,
  type CaptureRetryResponse,
  captureRetryResponseSchema,
} from '@jobflow/shared';

import { apiClient } from '@/shared/api';

export type RequestCvHints = Readonly<{
  applicationId: ApplicationResponse['id'];
  idempotencyKey: string;
}>;

export function requestCvHints({
  applicationId,
  idempotencyKey,
}: RequestCvHints): Promise<CaptureRetryResponse> {
  return apiClient.request({
    path: `/applications/${applicationId}/cv-hints`,
    method: 'POST',
    schema: captureRetryResponseSchema,
    idempotencyKey,
  });
}
