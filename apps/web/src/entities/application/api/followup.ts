import { type Application, followupResponseSchema } from '@jobflow/shared';
import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '@/shared/api';

import { applicationKeys } from '../model/keys';

export function applicationFollowupQueryOptions(id: Application['id']) {
  return queryOptions({
    queryKey: applicationKeys.followup(id),
    queryFn: ({ signal }) =>
      apiClient.request({
        path: `/applications/${id}/followup`,
        schema: followupResponseSchema,
        signal,
      }),
  });
}
