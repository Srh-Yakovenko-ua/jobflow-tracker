import { describe, expect, it } from 'vitest';

import { formatSalaryRange } from './salary';

const USD = { currency: 'USD' } as const;

describe('formatSalaryRange', () => {
  it('a full range gets the narrow symbol, uk-UA grouping and an en dash', () => {
    expect(formatSalaryRange({ salaryMin: 4500, salaryMax: 6000, ...USD })).toBe('$4 500–6 000');
  });

  it('only a floor reads as "від"', () => {
    expect(formatSalaryRange({ salaryMin: 4500, salaryMax: null, ...USD })).toBe('від $4 500');
  });

  it('only a ceiling reads as "до"', () => {
    expect(formatSalaryRange({ salaryMin: null, salaryMax: 6000, ...USD })).toBe('до $6 000');
  });

  it('a floor equal to the ceiling is one amount', () => {
    expect(formatSalaryRange({ salaryMin: 5800, salaryMax: 5800, ...USD })).toBe('$5 800');
  });

  it('hryvnia gets its own narrow symbol', () => {
    expect(formatSalaryRange({ salaryMin: 45000, salaryMax: 60000, currency: 'UAH' })).toBe(
      '₴45 000–60 000',
    );
  });

  it('a range without a currency shows the bare amounts', () => {
    expect(formatSalaryRange({ salaryMin: 4500, salaryMax: 6000, currency: null })).toBe(
      '4 500–6 000',
    );
  });

  it('no floor and no ceiling means no range', () => {
    expect(formatSalaryRange({ salaryMin: null, salaryMax: null, ...USD })).toBeNull();
  });
});
