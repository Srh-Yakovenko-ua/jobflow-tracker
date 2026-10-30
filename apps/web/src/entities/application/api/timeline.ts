import { type Application, applicationTimelineResponseSchema } from '@jobflow/shared';
import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '@/shared/api';

import { timelineKeys } from '../model/keys';

export function timelineQueryOptions(applicationId: Application['id']) {
  return queryOptions({
    queryKey: timelineKeys.detail(applicationId),
    queryFn: ({ signal }) =>
      apiClient.request({
        path: `/applications/${applicationId}/timeline`,
        schema: applicationTimelineResponseSchema,
        signal,
      }),
  });
}
