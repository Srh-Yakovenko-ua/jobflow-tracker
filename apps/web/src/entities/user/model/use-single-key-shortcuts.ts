import { useQuery } from '@tanstack/react-query';

import { meQueryOptions } from '../api/me';

export function useSingleKeyShortcuts(): boolean {
  return (
    useQuery({ ...meQueryOptions(), select: (me) => me.settings.singleKeyShortcuts }).data !== false
  );
}
