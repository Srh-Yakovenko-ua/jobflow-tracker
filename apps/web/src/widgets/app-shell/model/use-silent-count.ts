import type { ApplicationBoardQuery } from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';

import { boardQueryOptions, silentCountOf } from '@/entities/application';

const SILENT_ONLY: ApplicationBoardQuery = { silence: ['silent'] };

export function useSilentCount(): number {
  return useQuery({ ...boardQueryOptions(SILENT_ONLY), select: silentCountOf }).data ?? 0;
}
