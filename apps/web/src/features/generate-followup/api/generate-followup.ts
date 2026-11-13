import {
  type ApplicationResponse,
  type CaptureRetryResponse,
  captureRetryResponseSchema,
  type FollowupRequest,
} from '@jobflow/shared';

import { apiClient } from '@/shared/api';

export type GenerateFollowupRequest = Readonly<{
  applicationId: ApplicationResponse['id'];
  body: FollowupRequest;
  idempotencyKey: string;
}>;

export function generateFollowup({
  applicationId,
  body,
  idempotencyKey,
}: GenerateFollowupRequest): Promise<CaptureRetryResponse> {
  return apiClient.request({
    path: `/applications/${applicationId}/followup`,
    method: 'POST',
    body,
    schema: captureRetryResponseSchema,
    idempotencyKey,
  });
}
