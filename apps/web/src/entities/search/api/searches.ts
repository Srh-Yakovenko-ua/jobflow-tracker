import { searchListResponseSchema } from '@jobflow/shared';
import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '@/shared/api';

import { searchKeys } from '../model/keys';

export function searchesQueryOptions() {
  return queryOptions({
    queryKey: searchKeys.list(),
    queryFn: ({ signal }) =>
      apiClient.request({ path: '/searches', schema: searchListResponseSchema, signal }),
  });
}
