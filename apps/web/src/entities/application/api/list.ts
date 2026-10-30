import { type ApplicationListQuery, applicationListResponseSchema } from '@jobflow/shared';
import { queryOptions } from '@tanstack/react-query';

import { apiClient, withSearchParams } from '@/shared/api';

import { applicationKeys } from '../model/keys';

export function applicationListQueryOptions(query: ApplicationListQuery) {
  return queryOptions({
    queryKey: applicationKeys.list(query),
    queryFn: ({ signal }) =>
      apiClient.request({
        path: withSearchParams('/applications', query),
        schema: applicationListResponseSchema,
        signal,
      }),
  });
}
