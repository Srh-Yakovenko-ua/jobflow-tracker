import type { YearMonth } from '@jobflow/shared';

import { uk } from '@/shared/i18n';

const YEAR_DIGITS = 'YYYY'.length;

const MONTH_DIGITS_FROM = 'YYYY-'.length;

const MONTHS_PER_YEAR = 12;

function monthIndexOf(month: YearMonth): number {
  return Number(month.slice(MONTH_DIGITS_FROM)) - 1;
}

export function yearOf(month: YearMonth): string {
  return month.slice(0, YEAR_DIGITS);
}

export function monthNameOf(month: YearMonth): string {
  return uk.calendar.months[monthIndexOf(month)] ?? month;
}

export function monthInOf(month: YearMonth): string {
  return uk.calendar.monthsIn[monthIndexOf(month)] ?? month;
}

export function nextMonthOf(month: YearMonth): YearMonth {
  const following = Number(yearOf(month)) * MONTHS_PER_YEAR + monthIndexOf(month) + 1;
  const year = Math.floor(following / MONTHS_PER_YEAR);
  const number = (following % MONTHS_PER_YEAR) + 1;
  return `${String(year)}-${String(number).padStart(2, '0')}`;
}
