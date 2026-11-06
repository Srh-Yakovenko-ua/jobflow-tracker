export type CalendarMonth = { year: number; month: number };

export type DayParts = CalendarMonth & { date: number };

export type DayBounds = { min?: string | undefined; max?: string | undefined };

export type MonthCell = { day: string; date: number; outside: boolean };

const GRID = { short: 35, long: 42, week: 7 } as const;

const MONTHS_PER_YEAR = 12;

export function partsOfDay(day: string): DayParts {
  const [year = NaN, month = NaN, date = NaN] = day.split('-').map(Number);
  return { year, month: month - 1, date };
}

function dayKeyFrom({ year, month, date }: DayParts): string {
  return new Date(Date.UTC(year, month, date)).toISOString().slice(0, 10);
}

function daysInMonth({ year, month }: CalendarMonth): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

export function monthOf(day: string): CalendarMonth {
  const { year, month } = partsOfDay(day);
  return { year, month };
}

export function formatDay(day: string): string {
  return day.split('-').reverse().join('.');
}

export function addDays(day: string, count: number): string {
  const parts = partsOfDay(day);
  return dayKeyFrom({ ...parts, date: parts.date + count });
}

export function inMonth(day: string, month: CalendarMonth): string {
  const normal = monthOf(dayKeyFrom({ ...month, date: 1 }));
  return dayKeyFrom({ ...normal, date: Math.min(partsOfDay(day).date, daysInMonth(normal)) });
}

export function addMonths(day: string, count: number): string {
  const { year, month } = partsOfDay(day);
  return inMonth(day, { year, month: month + count });
}

export function addYears(day: string, count: number): string {
  return addMonths(day, count * MONTHS_PER_YEAR);
}

export function compareDays(first: string, second: string): number {
  return Number(first > second) - Number(first < second);
}

export function weekdayOf(day: string): number {
  return (new Date(`${day}T00:00:00Z`).getUTCDay() + GRID.week - 1) % GRID.week;
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
  const first = dayKeyFrom({ ...month, date: 1 });
  const start = addDays(first, -weekdayOf(first));
  const cells = Array.from({ length: GRID.long }, (_, index) => {
    const day = addDays(start, index);
    const parts = partsOfDay(day);
    return { day, date: parts.date, outside: parts.month !== month.month };
  });
  return cells[GRID.short]?.outside ? cells.slice(0, GRID.short) : cells;
}
