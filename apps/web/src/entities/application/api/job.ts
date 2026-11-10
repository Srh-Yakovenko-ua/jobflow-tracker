import { type JobStatus, jobStatusSchema } from '@jobflow/shared';
import { queryOptions, skipToken } from '@tanstack/react-query';

import { apiClient } from '@/shared/api';

import { jobKeys } from '../model/keys';

export function jobQueryOptions(id: JobStatus['id'] | null) {
  return queryOptions({
    queryKey: jobKeys.detail(id),
    queryFn:
      id === null
        ? skipToken
        : ({ signal }) =>
            apiClient.request({ path: `/jobs/${id}`, schema: jobStatusSchema, signal }),
  });
}
