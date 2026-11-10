import type { ApplicationResponse } from '@jobflow/shared';
import { z } from 'zod';

import { apiClient } from '@/shared/api';

export function confirmDraft(applicationId: ApplicationResponse['id']): Promise<void> {
  return apiClient.request({
    path: `/capture/drafts/${applicationId}/confirm`,
    method: 'POST',
    schema: z.void(),
  });
}
