import { DEFAULT_SILENCE_DAYS } from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';

import { meQueryOptions } from '../api/me';

export function useSilenceDays(): number {
  const { data = DEFAULT_SILENCE_DAYS } = useQuery({
    ...meQueryOptions(),
    select: (me) => me.settings.silenceDays,
  });
  return data;
}
