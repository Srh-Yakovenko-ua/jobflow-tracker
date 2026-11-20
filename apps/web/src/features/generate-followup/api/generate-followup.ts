import {
  type AiJobAccepted,
  aiJobAcceptedSchema,
  type ApplicationResponse,
  type FollowupRequest,
} from '@jobflow/shared';

import { applicationAiPath } from '@/entities/application';
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
}: GenerateFollowupRequest): Promise<AiJobAccepted> {
  return apiClient.request({
    path: applicationAiPath({ id: applicationId, segment: 'followup' }),
    method: 'POST',
    body,
    schema: aiJobAcceptedSchema,
    idempotencyKey,
  });
}
