import { resumeAbResponseSchema } from '@jobflow/shared';
import { queryOptions } from '@tanstack/react-query';

import { analyticsClient } from '@/shared/api';

import { resumeKeys } from '../model/keys';

export function resumeAbQueryOptions() {
  return queryOptions({
    queryKey: resumeKeys.ab(),
    queryFn: ({ signal }) =>
      analyticsClient.request({
        path: '/analytics/resume-ab',
        schema: resumeAbResponseSchema,
        signal,
      }),
  });
}
