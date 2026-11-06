import { type ApplicationListQuery, applicationListResponseSchema } from '@jobflow/shared';
import { queryOptions } from '@tanstack/react-query';

import { apiClient, withSearchParams } from '@/shared/api';

import { applicationKeys } from '../model/keys';

export type ApplicationPageRequest = Readonly<{ query: ApplicationListQuery; signal: AbortSignal }>;

export function fetchApplicationPage({ query, signal }: ApplicationPageRequest) {
  return apiClient.request({
    path: withSearchParams('/applications', query),
    schema: applicationListResponseSchema,
    signal,
  });
}

export function applicationListQueryOptions(query: ApplicationListQuery) {
  return queryOptions({
    queryKey: applicationKeys.list(query),
    queryFn: ({ signal }) => fetchApplicationPage({ query, signal }),
  });
}
