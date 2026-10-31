import type { ChangePasswordInput } from '@jobflow/shared';
import { z } from 'zod';

import { apiClient } from '@/shared/api';

export function changePassword(body: ChangePasswordInput): Promise<void> {
  return apiClient.request({
    path: '/auth/change-password',
    method: 'POST',
    body,
    schema: z.void(),
  });
}
