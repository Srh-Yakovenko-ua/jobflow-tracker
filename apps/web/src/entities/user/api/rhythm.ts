import { rhythmResponseSchema } from '@jobflow/shared';
import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '@/shared/api';

import { userKeys } from '../model/keys';

export function rhythmQueryOptions() {
  return queryOptions({
    queryKey: userKeys.rhythm(),
    queryFn: ({ signal }) =>
      apiClient.request({ path: '/rhythm', schema: rhythmResponseSchema, signal }),
  });
}
