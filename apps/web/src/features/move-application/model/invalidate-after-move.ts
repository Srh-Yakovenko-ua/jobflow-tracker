import type { QueryClient } from '@tanstack/react-query';

import { analyticsKeys } from '@/entities/analytics';
import { applicationKeys } from '@/entities/application';

export async function invalidateAfterMove(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: applicationKeys.boards() }),
    queryClient.invalidateQueries({ queryKey: analyticsKeys.summary() }),
  ]);
}
