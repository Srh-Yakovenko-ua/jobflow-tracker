import type { DeleteAccountInput } from '@jobflow/shared';
import { z } from 'zod';

import { apiClient } from '@/shared/api';

export function deleteAccount(body: DeleteAccountInput): Promise<void> {
  return apiClient.request({ path: '/me', method: 'DELETE', body, schema: z.void() });
}
