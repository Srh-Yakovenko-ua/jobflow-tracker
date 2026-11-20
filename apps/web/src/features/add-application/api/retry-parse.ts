import { type AiJobAccepted, aiJobAcceptedSchema, type ApplicationResponse } from '@jobflow/shared';

import { apiClient } from '@/shared/api';

export function retryDraftParse(applicationId: ApplicationResponse['id']): Promise<AiJobAccepted> {
  return apiClient.request({
    path: `/capture/drafts/${applicationId}/retry`,
    method: 'POST',
    schema: aiJobAcceptedSchema,
  });
}
