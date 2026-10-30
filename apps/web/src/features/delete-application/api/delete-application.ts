import type { ApplicationResponse } from '@jobflow/shared';
import { z } from 'zod';

import { apiClient } from '@/shared/api';

export function deleteApplication(applicationId: ApplicationResponse['id']): Promise<void> {
  return apiClient.request({
    path: `/applications/${applicationId}`,
    method: 'DELETE',
    schema: z.void(),
  });
}
