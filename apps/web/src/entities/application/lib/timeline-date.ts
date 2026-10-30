import { uk } from '@/shared/i18n';
import { formatDayMonth, formatDayMonthYear } from '@/shared/lib/state-format';

import { calendarDateOf, calendarDayOf } from './calendar-date';

export type TimelineDateInput = { at: Date; now: Date; timeZone: string };

const RELATIVE_DAYS = 7;

const RELATIVE = new Intl.RelativeTimeFormat(uk.locale, { numeric: 'auto' });

function yearOf(date: Date, timeZone: string): number {
  return calendarDateOf(date, timeZone).getUTCFullYear();
}

export function formatTimelineDate({ at, now, timeZone }: TimelineDateInput): string {
  const days = calendarDayOf(now, timeZone) - calendarDayOf(at, timeZone);
  if (days >= 0 && days < RELATIVE_DAYS) {
    return RELATIVE.format(-days, 'day');
  }
  const sameYear = yearOf(at, timeZone) === yearOf(now, timeZone);
  return sameYear ? formatDayMonth({ at, timeZone }) : formatDayMonthYear({ at, timeZone });
}
