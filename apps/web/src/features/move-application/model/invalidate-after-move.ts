import type { QueryClient } from '@tanstack/react-query';

import { analyticsKeys } from '@/entities/analytics';
import { applicationKeys, timelineKeys } from '@/entities/application';

export async function invalidateAfterMove(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: applicationKeys.boards() }),
    queryClient.invalidateQueries({ queryKey: applicationKeys.details() }),
    queryClient.invalidateQueries({ queryKey: applicationKeys.reasonsSummaries() }),
    queryClient.invalidateQueries({ queryKey: timelineKeys.all }),
    queryClient.invalidateQueries({ queryKey: analyticsKeys.summary() }),
  ]);
}
