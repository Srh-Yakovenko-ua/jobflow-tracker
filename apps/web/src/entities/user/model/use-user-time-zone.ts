import { useQuery } from '@tanstack/react-query';

import { meQueryOptions } from '../api/me';

function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function useSettledTimeZone(): string | null {
  const { data, isError } = useQuery({ ...meQueryOptions(), select: (me) => me.settings.timezone });
  if (data !== undefined) return data;
  return isError ? browserTimeZone() : null;
}

export function useUserTimeZone(): string {
  return useSettledTimeZone() ?? browserTimeZone();
}
