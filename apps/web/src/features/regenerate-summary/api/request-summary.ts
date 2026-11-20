import { type AiJobAccepted, aiJobAcceptedSchema } from '@jobflow/shared';

import { apiClient } from '@/shared/api';

export function requestSummary(idempotencyKey: string): Promise<AiJobAccepted> {
  return apiClient.request({
    path: '/summaries',
    method: 'POST',
    schema: aiJobAcceptedSchema,
    idempotencyKey,
  });
}
