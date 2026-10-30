import { meResponseSchema } from '@jobflow/shared';
import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '@/shared/api';

import { userKeys } from '../model/keys';

export function meQueryOptions() {
  return queryOptions({
    queryKey: userKeys.me(),
    queryFn: ({ signal }) =>
      apiClient.request({ path: '/auth/me', schema: meResponseSchema, signal }),
  });
}
