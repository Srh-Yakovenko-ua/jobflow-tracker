import { type Application, applicationMatchResponseSchema } from '@jobflow/shared';
import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '@/shared/api';

import { applicationKeys } from '../model/keys';

export function applicationMatchQueryOptions(id: Application['id']) {
  return queryOptions({
    queryKey: applicationKeys.match(id),
    queryFn: ({ signal }) =>
      apiClient.request({
        path: `/applications/${id}/match`,
        schema: applicationMatchResponseSchema,
        signal,
      }),
  });
}
