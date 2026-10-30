import { countedUk } from '@jobflow/shared';

import { uk } from '@/shared/i18n';

const FORMS = uk.states.forms;

const SECONDS_PER_MINUTE = 60;

const MEBIBYTE = 1024 * 1024;

const TENTHS = 10;

const UP_TO_ONE_DECIMAL = new Intl.NumberFormat(uk.locale, { maximumFractionDigits: 1 });

const CLOCK = { hour: '2-digit', minute: '2-digit' } as const;

const INCIDENT_TIME = { day: '2-digit', month: '2-digit', ...CLOCK } as const;

export type ZonedInstant = { at: Date; timeZone: string | undefined };

export function formatDuration(seconds: number): string {
  const whole = Math.ceil(seconds);
  if (whole < SECONDS_PER_MINUTE) {
    return countedUk(whole, FORMS.secondShort);
  }
  return countedUk(Math.ceil(whole / SECONDS_PER_MINUTE), FORMS.minuteShort);
}

export function formatMegabytes(bytes: number): string {
  return UP_TO_ONE_DECIMAL.format(Math.ceil((bytes * TENTHS) / MEBIBYTE) / TENTHS);
}

function formatZoned({ at, timeZone }: ZonedInstant, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(uk.locale, { ...options, timeZone }).format(at);
}

export function formatClock(instant: ZonedInstant): string {
  return formatZoned(instant, CLOCK);
}

export function formatIncidentTime(instant: ZonedInstant): string {
  return formatZoned(instant, INCIDENT_TIME);
}
