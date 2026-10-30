import { type Application, applicationResponseSchema } from '@jobflow/shared';
import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '@/shared/api';

import { applicationKeys } from '../model/keys';

export function applicationQueryOptions(id: Application['id']) {
  return queryOptions({
    queryKey: applicationKeys.detail(id),
    queryFn: ({ signal }) =>
      apiClient.request({ path: `/applications/${id}`, schema: applicationResponseSchema, signal }),
  });
}
