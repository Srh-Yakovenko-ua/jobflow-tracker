import { summaryArchiveSchema, summaryResponseSchema } from '@jobflow/shared';
import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '@/shared/api';

import { summaryKeys } from '../model/keys';

export function latestSummaryQueryOptions() {
  return queryOptions({
    queryKey: summaryKeys.latest(),
    queryFn: ({ signal }) =>
      apiClient.request({ path: '/summaries/latest', schema: summaryResponseSchema, signal }),
  });
}

export function summaryArchiveQueryOptions() {
  return queryOptions({
    queryKey: summaryKeys.archive(),
    queryFn: ({ signal }) =>
      apiClient.request({ path: '/summaries', schema: summaryArchiveSchema, signal }),
  });
}
