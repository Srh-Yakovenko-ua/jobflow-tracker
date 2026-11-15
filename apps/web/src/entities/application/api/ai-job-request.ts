import {
  type ApplicationResponse,
  type CaptureRetryResponse,
  captureRetryResponseSchema,
} from '@jobflow/shared';

import { apiClient } from '@/shared/api';

export type ApplicationAiSegment = 'cv-hints' | 'interview-prep';

export type ApplicationAiJobRequest = Readonly<{
  applicationId: ApplicationResponse['id'];
  segment: ApplicationAiSegment;
  idempotencyKey: string;
}>;

export function requestApplicationAiJob({
  applicationId,
  segment,
  idempotencyKey,
}: ApplicationAiJobRequest): Promise<CaptureRetryResponse> {
  return apiClient.request({
    path: `/applications/${applicationId}/${segment}`,
    method: 'POST',
    schema: captureRetryResponseSchema,
    idempotencyKey,
  });
}
