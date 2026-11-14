import { useQuery } from '@tanstack/react-query';

import { boardQueryOptions } from '../api/board';
import { SILENT_ONLY, silentCountOf } from '../lib/silent-count';

export function useSilentCount(): number {
  return useQuery({ ...boardQueryOptions(SILENT_ONLY), select: silentCountOf }).data ?? 0;
}
