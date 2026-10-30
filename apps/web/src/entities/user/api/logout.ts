import { z } from 'zod';

import { apiClient } from '@/shared/api';

export function logout(): Promise<void> {
  return apiClient.request({ path: '/auth/logout', method: 'POST', schema: z.void() });
}
