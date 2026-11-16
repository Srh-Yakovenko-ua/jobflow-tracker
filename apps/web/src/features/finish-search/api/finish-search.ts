import {
  type FinishSearchInput,
  type FinishSearchResponse,
  finishSearchResponseSchema,
} from '@jobflow/shared';

import { apiClient } from '@/shared/api';

export function finishSearch(body: FinishSearchInput): Promise<FinishSearchResponse> {
  return apiClient.request({
    path: '/searches/current/finish',
    method: 'POST',
    body,
    schema: finishSearchResponseSchema,
  });
}
