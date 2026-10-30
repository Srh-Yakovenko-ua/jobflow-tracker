import { countedUk, DAY_FORMS_UK, wholeDaysBetween } from '@jobflow/shared';

import { uk } from '@/shared/i18n';

import { calendarDateOf } from './calendar-date';

const COPY = uk.application;

export type DaysInFunnelInput = { appliedAt: string; now: Date; timeZone: string };

export function formatDaysInFunnel({ appliedAt, now, timeZone }: DaysInFunnelInput): string {
  const days = wholeDaysBetween(
    calendarDateOf(new Date(appliedAt), timeZone),
    calendarDateOf(now, timeZone),
  );
  return COPY.inFunnel(countedUk(days, DAY_FORMS_UK));
}
