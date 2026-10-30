import { useQuery } from '@tanstack/react-query';

import { meQueryOptions } from '../api/me';

export function useUserTimeZone(): string {
  const { data } = useQuery({ ...meQueryOptions(), select: (me) => me.settings.timezone });
  return data ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}
