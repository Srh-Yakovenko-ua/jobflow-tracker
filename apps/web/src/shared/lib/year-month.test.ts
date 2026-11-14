import { describe, expect, it } from 'vitest';

import { monthInOf, monthNameOf, nextMonthOf, yearOf } from './year-month';

describe('year-month', () => {
  it.each([
    { month: '2026-01', name: 'січень', inMonth: 'січні' },
    { month: '2026-08', name: 'серпень', inMonth: 'серпні' },
    { month: '2026-09', name: 'вересень', inMonth: 'вересні' },
    { month: '2026-12', name: 'грудень', inMonth: 'грудні' },
  ])('$month is $name, and "у $inMonth" in the locative', ({ month, name, inMonth }) => {
    expect(monthNameOf(month)).toBe(name);
    expect(monthInOf(month)).toBe(inMonth);
  });

  it.each([
    { month: '2026-08', next: '2026-09' },
    { month: '2026-12', next: '2027-01' },
  ])('the month after $month is $next', ({ month, next }) => {
    expect(nextMonthOf(month)).toBe(next);
  });

  it('reads the year of a month', () => {
    expect(yearOf('2026-08')).toBe('2026');
  });
});
