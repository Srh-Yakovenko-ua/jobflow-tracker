import { z } from 'zod';

import { apiClient } from '@/shared/api';

export function deleteAiResults(): Promise<void> {
  return apiClient.request({ path: '/ai-results', method: 'DELETE', schema: z.void() });
}
