import {
  type ApplicationResponse,
  applicationResponseSchema,
  type UpdateApplicationInput,
} from '@jobflow/shared';

import { apiClient } from '@/shared/api';

export type UpdateApplicationRequest = Readonly<{
  applicationId: ApplicationResponse['id'];
  body: UpdateApplicationInput;
}>;

export function updateApplication({
  applicationId,
  body,
}: UpdateApplicationRequest): Promise<ApplicationResponse> {
  return apiClient.request({
    path: `/applications/${applicationId}`,
    method: 'PATCH',
    body,
    schema: applicationResponseSchema,
  });
}
