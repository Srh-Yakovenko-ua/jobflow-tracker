import { tz } from '@date-fns/tz';
import { differenceInCalendarDays, isSameYear } from 'date-fns';

import { uk } from '@/shared/i18n';
import { formatDayMonth, formatDayMonthYear } from '@/shared/lib/state-format';

export type TimelineDateInput = { at: Date; now: Date; timeZone: string };

const RELATIVE_DAYS = 7;

const RELATIVE = new Intl.RelativeTimeFormat(uk.locale, { numeric: 'auto' });

export function formatTimelineDate({ at, now, timeZone }: TimelineDateInput): string {
  const inZone = { in: tz(timeZone) };
  const days = differenceInCalendarDays(now, at, inZone);
  if (days >= 0 && days < RELATIVE_DAYS) {
    return RELATIVE.format(-days, 'day');
  }
  const sameYear = isSameYear(at, now, inZone);
  return sameYear ? formatDayMonth({ at, timeZone }) : formatDayMonthYear({ at, timeZone });
}
