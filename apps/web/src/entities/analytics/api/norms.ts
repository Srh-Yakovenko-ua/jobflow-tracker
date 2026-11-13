import { type NormsResponse, normsResponseSchema } from '@jobflow/shared';

import { analyticsClient } from '@/shared/api';

export function fetchNorms(signal: AbortSignal): Promise<NormsResponse> {
  return analyticsClient.request({ path: '/analytics/norms', schema: normsResponseSchema, signal });
}
