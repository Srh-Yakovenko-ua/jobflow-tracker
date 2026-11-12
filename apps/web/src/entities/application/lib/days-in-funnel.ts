import { tz } from '@date-fns/tz';
import { countedUk, DAY_FORMS_UK } from '@jobflow/shared';
import { differenceInCalendarDays } from 'date-fns';

import { uk } from '@/shared/i18n';

const COPY = uk.application;

export type DaysInFunnelInput = { appliedAt: string; now: Date; timeZone: string };

export function daysInFunnelOf({ appliedAt, now, timeZone }: DaysInFunnelInput): number {
  return Math.max(0, differenceInCalendarDays(now, appliedAt, { in: tz(timeZone) }));
}

export function formatDaysInFunnel(input: DaysInFunnelInput): string {
  return COPY.inFunnel(countedUk(daysInFunnelOf(input), DAY_FORMS_UK));
}
