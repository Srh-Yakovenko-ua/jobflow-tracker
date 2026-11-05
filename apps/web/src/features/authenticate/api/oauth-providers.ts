import { oauthProvidersResponseSchema } from '@jobflow/shared';
import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '@/shared/api';

import { authKeys } from '../model/keys';

export function oauthProvidersQueryOptions() {
  return queryOptions({
    queryKey: authKeys.oauthProviders(),
    queryFn: ({ signal }) =>
      apiClient.request({
        path: '/auth/oauth/providers',
        schema: oauthProvidersResponseSchema,
        signal,
      }),
    staleTime: Infinity,
  });
}
