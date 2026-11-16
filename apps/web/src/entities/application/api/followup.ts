import { type Application, followupResponseSchema } from '@jobflow/shared';
import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '@/shared/api';

import { applicationKeys } from '../model/keys';

export function fetchApplicationFollowup(id: Application['id'], signal: AbortSignal) {
  return apiClient.request({
    path: `/applications/${id}/followup`,
    schema: followupResponseSchema,
    signal,
  });
}

export function applicationFollowupQueryOptions(id: Application['id']) {
  return queryOptions({
    queryKey: applicationKeys.followup(id),
    queryFn: ({ signal }) => fetchApplicationFollowup(id, signal),
  });
}
