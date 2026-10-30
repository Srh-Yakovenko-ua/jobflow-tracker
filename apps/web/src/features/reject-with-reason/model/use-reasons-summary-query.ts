import type { Stage } from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';

import { applicationKeys } from '@/entities/application';

import { fetchReasonsSummary } from '../api/reasons-summary';

export function useReasonsSummaryQuery(stage: Stage) {
  return useQuery({
    queryKey: applicationKeys.reasonsSummary(stage),
    queryFn: ({ signal }) => fetchReasonsSummary({ stage, signal }),
  });
}
