import { type JobStatus, jobStatusSchema } from '@jobflow/shared';
import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '@/shared/api';

import { jobKeys } from '../model/keys';

export function jobQueryOptions(id: JobStatus['id']) {
  return queryOptions({
    queryKey: jobKeys.detail(id),
    queryFn: ({ signal }) =>
      apiClient.request({ path: `/jobs/${id}`, schema: jobStatusSchema, signal }),
  });
}
