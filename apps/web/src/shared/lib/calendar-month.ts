import {
  addDays as addCalendarDays,
  addMonths as addCalendarMonths,
  eachDayOfInterval,
  format,
  getDate,
  getISODay,
  isSameMonth,
  parseISO,
  subDays,
} from 'date-fns';

export type CalendarMonth = { year: number; month: number };

export type DayParts = CalendarMonth & { date: number };

export type DayBounds = { min?: string | undefined; max?: string | undefined };

export type MonthCell = { day: string; date: number; outside: boolean };

const GRID = { short: 35, long: 42 } as const;

const MONTHS_PER_YEAR = 12;

const ISO_MONDAY = 1;

function dayKeyOf(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function partsOfDay(day: string): DayParts {
  const [year = NaN, month = NaN, date = NaN] = day.split('-').map(Number);
  return { year, month: month - 1, date };
}

export function monthOf(day: string): CalendarMonth {
  const { year, month } = partsOfDay(day);
  return { year, month };
}

export function formatDay(day: string): string {
  return day.split('-').reverse().join('.');
}

export function addDays(day: string, count: number): string {
  return dayKeyOf(addCalendarDays(parseISO(day), count));
}

export function addMonths(day: string, count: number): string {
  return dayKeyOf(addCalendarMonths(parseISO(day), count));
}

export function inMonth(day: string, { year, month }: CalendarMonth): string {
  const parts = partsOfDay(day);
  return addMonths(day, (year - parts.year) * MONTHS_PER_YEAR + month - parts.month);
}

export function addYears(day: string, count: number): string {
  return addMonths(day, count * MONTHS_PER_YEAR);
}

export function compareDays(first: string, second: string): number {
  return Number(first > second) - Number(first < second);
}

export function weekdayOf(day: string): number {
  return getISODay(parseISO(day)) - ISO_MONDAY;
}

export function isOutsideBounds(day: string, { min, max }: DayBounds): boolean {
  return (min !== undefined && day < min) || (max !== undefined && day > max);
}

export function clampDay(day: string, { min, max }: DayBounds): string {
  if (min !== undefined && day < min) return min;
  if (max !== undefined && day > max) return max;
  return day;
}

export function monthGrid(month: CalendarMonth): MonthCell[] {
  const first = new Date(month.year, month.month, 1);
  const start = subDays(first, getISODay(first) - ISO_MONDAY);
  const end = addCalendarDays(start, GRID.long - 1);
  const cells = eachDayOfInterval({ start, end }).map((date) => ({
    day: dayKeyOf(date),
    date: getDate(date),
    outside: !isSameMonth(date, first),
  }));
  return cells[GRID.short]?.outside ? cells.slice(0, GRID.short) : cells;
}
