import { type ApplicationResponse, applicationResponseSchema } from '@jobflow/shared';

import { apiClient } from '@/shared/api';

export function undoLastMove(
  applicationId: ApplicationResponse['id'],
): Promise<ApplicationResponse> {
  return apiClient.request({
    path: `/applications/${applicationId}/events/undo-last`,
    method: 'POST',
    schema: applicationResponseSchema,
  });
}
