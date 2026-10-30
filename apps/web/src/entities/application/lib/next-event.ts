import type { ApplicationCard } from '@jobflow/shared';

import { uk } from '@/shared/i18n';

import { calendarDayOf } from './calendar-date';

const COPY = uk.application.nextEvent;

const RELATIVE_DAYS = [COPY.today, COPY.tomorrow] as const;

const TIME = { hour: '2-digit', minute: '2-digit' } as const;

const DATE_TIME = { day: 'numeric', month: 'short', ...TIME } as const;

export type ScheduledEventSlot = NonNullable<ApplicationCard['nextScheduledEvent']>;

export type NextEventInput = { event: ScheduledEventSlot; now: Date; timeZone: string };

export function formatNextEvent({ event, now, timeZone }: NextEventInput): string {
  const startsAt = new Date(event.startsAt);
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(uk.locale, { ...options, timeZone }).format(startsAt);
  const relativeDay =
    RELATIVE_DAYS[calendarDayOf(startsAt, timeZone) - calendarDayOf(now, timeZone)];
  const when =
    relativeDay === undefined ? format(DATE_TIME) : COPY.relative(relativeDay, format(TIME));
  return COPY.phrase(COPY.kinds[event.kind], when);
}
