import { type Application, scheduledEventListResponseSchema } from '@jobflow/shared';
import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '@/shared/api';

import { scheduledEventKeys } from '../model/keys';

export function scheduledEventsQueryOptions(applicationId: Application['id']) {
  return queryOptions({
    queryKey: scheduledEventKeys.list(applicationId),
    queryFn: ({ signal }) =>
      apiClient.request({
        path: `/applications/${applicationId}/scheduled-events`,
        schema: scheduledEventListResponseSchema,
        signal,
      }),
  });
}
