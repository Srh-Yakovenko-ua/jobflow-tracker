import { type AiJobAccepted, aiJobAcceptedSchema, type ApplicationResponse } from '@jobflow/shared';

import { apiClient } from '@/shared/api';

import type { ApplicationAiSegment } from './application-ai';

export type ApplicationAiJobSegment = Extract<ApplicationAiSegment, 'cv-hints' | 'interview-prep'>;

export type ApplicationAiJobRequest = Readonly<{
  applicationId: ApplicationResponse['id'];
  segment: ApplicationAiJobSegment;
  idempotencyKey: string;
}>;

export function requestApplicationAiJob({
  applicationId,
  segment,
  idempotencyKey,
}: ApplicationAiJobRequest): Promise<AiJobAccepted> {
  return apiClient.request({
    path: `/applications/${applicationId}/${segment}`,
    method: 'POST',
    schema: aiJobAcceptedSchema,
    idempotencyKey,
  });
}
