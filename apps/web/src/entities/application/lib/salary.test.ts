import { buildDesignOffers } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { formatSalaryRange, usdNetPerMonthOf } from './salary';

const USD = { currency: 'USD' } as const;

const [USD_NET, EUR_GROSS, UAH_NET, NO_SALARY] = buildDesignOffers(4);

describe('usdNetPerMonthOf', () => {
  it.each([
    { title: '5000 USD net stays 5000', offer: USD_NET, expected: 5000 },
    { title: '4000 EUR gross is 4000 / 0.86 × 0.77, 3581', offer: EUR_GROSS, expected: 3581 },
    { title: '200000 UAH net is 200000 / 41.5, 4819', offer: UAH_NET, expected: 4819 },
    { title: 'no salary is not counted', offer: NO_SALARY, expected: null },
  ])('$title', ({ offer, expected }) => {
    expect(offer && usdNetPerMonthOf(offer)).toBe(expected);
  });

  it('a currency outside USD, EUR and UAH is not converted', () => {
    expect(
      usdNetPerMonthOf({ salaryMin: 5000, salaryMax: 5000, currency: 'GBP', aiParsed: null }),
    ).toBeNull();
  });

  it('a range counts at its midpoint and one side stands in for the missing other', () => {
    expect(usdNetPerMonthOf({ salaryMin: 4000, salaryMax: 6000, ...USD, aiParsed: null })).toBe(
      5000,
    );
    expect(usdNetPerMonthOf({ salaryMin: null, salaryMax: 3000, ...USD, aiParsed: null })).toBe(
      3000,
    );
  });

  it('a parse without a readable tax counts as net', () => {
    expect(
      usdNetPerMonthOf({ salaryMin: 5000, salaryMax: 5000, ...USD, aiParsed: { salaryTax: 'x' } }),
    ).toBe(5000);
  });
});

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
