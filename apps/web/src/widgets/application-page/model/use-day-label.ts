import type { UseQueryResult } from '@tanstack/react-query';

import { formatTimelineDate } from '@/entities/application';
import { useUserTimeZone } from '@/entities/user';
import { useQueryNow } from '@/shared/lib/use-query-now';

export type DayLabel = (at: string) => string;

export function useDayLabel(query: Pick<UseQueryResult, 'dataUpdatedAt'>): DayLabel {
  const timeZone = useUserTimeZone();
  const now = useQueryNow(query);
  return (at) => formatTimelineDate({ at: new Date(at), now, timeZone });
}
