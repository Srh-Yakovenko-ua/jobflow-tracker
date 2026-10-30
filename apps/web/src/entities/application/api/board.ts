import { type ApplicationBoardQuery, applicationBoardResponseSchema } from '@jobflow/shared';
import { queryOptions } from '@tanstack/react-query';

import { apiClient, withSearchParams } from '@/shared/api';

import { applicationKeys } from '../model/keys';

export function boardQueryOptions(query: ApplicationBoardQuery) {
  return queryOptions({
    queryKey: applicationKeys.board(query),
    queryFn: ({ signal }) =>
      apiClient.request({
        path: withSearchParams('/applications/board', query),
        schema: applicationBoardResponseSchema,
        signal,
      }),
  });
}
