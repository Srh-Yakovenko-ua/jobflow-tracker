import type { ApplicationResponse } from '@jobflow/shared';
import { z } from 'zod';

import { apiClient } from '@/shared/api';

export type MarkFollowupSentRequest = Readonly<{
  applicationId: ApplicationResponse['id'];
  idempotencyKey: string;
}>;

export function markFollowupSent({
  applicationId,
  idempotencyKey,
}: MarkFollowupSentRequest): Promise<void> {
  return apiClient.request({
    path: `/applications/${applicationId}/followup/sent`,
    method: 'POST',
    schema: z.void(),
    idempotencyKey,
  });
}
