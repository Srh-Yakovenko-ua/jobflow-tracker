import type { SearchSummary } from '@jobflow/shared';

import { uk } from '@/shared/i18n';
import { formatDayMonthYear } from '@/shared/lib/state-format';

export function searchDatesOf({ startedAt, finishedAt }: SearchSummary, timeZone: string): string {
  const day = (iso: string) => formatDayMonthYear({ at: new Date(iso), timeZone });
  return finishedAt === null
    ? day(startedAt)
    : uk.analytics.search.period(day(startedAt), day(finishedAt));
}
