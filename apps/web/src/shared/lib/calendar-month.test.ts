import { describe, expect, it } from 'vitest';

import {
  addDays,
  addMonths,
  addYears,
  clampDay,
  compareDays,
  formatDay,
  inMonth,
  isOutsideBounds,
  monthGrid,
  monthOf,
  partsOfDay,
  weekdayOf,
} from './calendar-month';

describe('calendar month maths', () => {
  it('reads a day key into its parts and writes it back as dd.mm.yyyy', () => {
    expect(partsOfDay('2026-09-03')).toEqual({ year: 2026, month: 8, date: 3 });
    expect(monthOf('2026-09-03')).toEqual({ year: 2026, month: 8 });
    expect(formatDay('2026-09-03')).toBe('03.09.2026');
  });

  it.each([
    { day: '2026-12-31', count: 1, moved: '2027-01-01' },
    { day: '2026-03-01', count: -1, moved: '2026-02-28' },
    { day: '2028-03-01', count: -1, moved: '2028-02-29' },
    { day: '2026-09-28', count: 7, moved: '2026-10-05' },
    { day: '2026-09-03', count: -7, moved: '2026-08-27' },
  ])('$day moved by $count days lands on $moved', ({ day, count, moved }) => {
    expect(addDays(day, count)).toBe(moved);
  });

  it.each([
    { day: '2026-01-31', count: 1, moved: '2026-02-28' },
    { day: '2026-03-31', count: -1, moved: '2026-02-28' },
    { day: '2026-12-15', count: 1, moved: '2027-01-15' },
    { day: '2026-01-15', count: -1, moved: '2025-12-15' },
  ])('$day moved by $count months lands on $moved', ({ day, count, moved }) => {
    expect(addMonths(day, count)).toBe(moved);
  });

  it.each([
    { day: '2028-02-29', count: 1, moved: '2029-02-28' },
    { day: '2026-09-07', count: -1, moved: '2025-09-07' },
  ])('$day moved by $count years lands on $moved', ({ day, count, moved }) => {
    expect(addYears(day, count)).toBe(moved);
  });

  it('keeps the date number when the view moves to another month, cut to its last day', () => {
    expect(inMonth('2026-08-31', { year: 2026, month: 1 })).toBe('2026-02-28');
    expect(inMonth('2026-08-12', { year: 2031, month: 4 })).toBe('2031-05-12');
  });

  it('orders day keys and reads the weekday from Monday', () => {
    expect(compareDays('2026-09-07', '2026-09-08')).toBe(-1);
    expect(compareDays('2026-09-07', '2026-09-07')).toBe(0);
    expect(compareDays('2027-01-01', '2026-12-31')).toBe(1);
    expect(weekdayOf('2026-09-07')).toBe(0);
    expect(weekdayOf('2026-09-13')).toBe(6);
  });

  it.each([
    { day: '2026-09-01', bounds: { min: '2026-09-07' }, clamped: '2026-09-07', outside: true },
    { day: '2026-09-30', bounds: { max: '2026-09-07' }, clamped: '2026-09-07', outside: true },
    {
      day: '2026-09-10',
      bounds: { min: '2026-09-07', max: '2026-09-20' },
      clamped: '2026-09-10',
      outside: false,
    },
    { day: '2026-09-07', bounds: { min: '2026-09-07' }, clamped: '2026-09-07', outside: false },
    { day: '1999-01-01', bounds: {}, clamped: '1999-01-01', outside: false },
  ])('$day within $bounds clamps to $clamped', ({ day, bounds, clamped, outside }) => {
    expect(clampDay(day, bounds)).toBe(clamped);
    expect(isOutsideBounds(day, bounds)).toBe(outside);
  });
});

describe('monthGrid', () => {
  it('starts on Monday and keeps 35 cells when the sixth row would be all next month', () => {
    const cells = monthGrid({ year: 2026, month: 8 });

    expect(cells).toHaveLength(35);
    expect(cells[0]).toEqual({ day: '2026-08-31', date: 31, outside: true });
    expect(cells[1]).toEqual({ day: '2026-09-01', date: 1, outside: false });
    expect(cells[30]).toEqual({ day: '2026-09-30', date: 30, outside: false });
    expect(cells[34]).toEqual({ day: '2026-10-04', date: 4, outside: true });
  });

  it('grows to 42 cells when the month needs a sixth row', () => {
    const cells = monthGrid({ year: 2026, month: 2 });

    expect(cells).toHaveLength(42);
    expect(cells[5]).toEqual({ day: '2026-02-28', date: 28, outside: true });
    expect(cells[6]).toEqual({ day: '2026-03-01', date: 1, outside: false });
    expect(cells[36]).toEqual({ day: '2026-03-31', date: 31, outside: false });
    expect(cells[41]).toEqual({ day: '2026-04-05', date: 5, outside: true });
  });

  it('keeps every day across the Kyiv spring change in March 2026', () => {
    const cells = monthGrid({ year: 2026, month: 2 });

    expect(cells).toHaveLength(42);
    expect(cells[0]?.day).toBe('2026-02-23');
    expect(cells[34]).toEqual({ day: '2026-03-29', date: 29, outside: false });
    expect(cells[35]).toEqual({ day: '2026-03-30', date: 30, outside: false });
    expect(cells[41]?.day).toBe('2026-04-05');
  });

  it('keeps every day across the Kyiv autumn change in October 2026', () => {
    const cells = monthGrid({ year: 2026, month: 9 });

    expect(cells).toHaveLength(35);
    expect(cells[0]?.day).toBe('2026-09-28');
    expect(cells[27]).toEqual({ day: '2026-10-25', date: 25, outside: false });
    expect(cells[28]).toEqual({ day: '2026-10-26', date: 26, outside: false });
    expect(cells[34]?.day).toBe('2026-11-01');
  });

  it('reaches into the previous year for January and keeps a February from Monday at 35', () => {
    expect(monthGrid({ year: 2026, month: 0 }).slice(0, 4)).toEqual([
      { day: '2025-12-29', date: 29, outside: true },
      { day: '2025-12-30', date: 30, outside: true },
      { day: '2025-12-31', date: 31, outside: true },
      { day: '2026-01-01', date: 1, outside: false },
    ]);
    const february = monthGrid({ year: 2027, month: 1 });
    expect(february).toHaveLength(35);
    expect(february[0]).toEqual({ day: '2027-02-01', date: 1, outside: false });
    expect(february[28]).toEqual({ day: '2027-03-01', date: 1, outside: true });
  });
});
