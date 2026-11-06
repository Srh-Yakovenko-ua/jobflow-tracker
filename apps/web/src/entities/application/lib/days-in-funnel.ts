import { countedUk, DAY_FORMS_UK, wholeDaysBetween } from '@jobflow/shared';

import { uk } from '@/shared/i18n';

import { calendarDateOf } from './calendar-date';

const COPY = uk.application;

export type DaysInFunnelInput = { appliedAt: string; now: Date; timeZone: string };

export function daysInFunnelOf({ appliedAt, now, timeZone }: DaysInFunnelInput): number {
  return wholeDaysBetween(
    calendarDateOf(new Date(appliedAt), timeZone),
    calendarDateOf(now, timeZone),
  );
}

export function formatDaysInFunnel(input: DaysInFunnelInput): string {
  return COPY.inFunnel(countedUk(daysInFunnelOf(input), DAY_FORMS_UK));
}
