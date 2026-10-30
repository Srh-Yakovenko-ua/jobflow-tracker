import {
  type ApplicationResponse,
  applicationResponseSchema,
  type MoveApplicationInput,
} from '@jobflow/shared';

import { apiClient } from '@/shared/api';

export type MoveApplicationRequest = Readonly<{
  applicationId: ApplicationResponse['id'];
  body: MoveApplicationInput;
}>;

export function moveApplication({
  applicationId,
  body,
}: MoveApplicationRequest): Promise<ApplicationResponse> {
  return apiClient.request({
    path: `/applications/${applicationId}/events`,
    method: 'POST',
    body,
    schema: applicationResponseSchema,
  });
}
