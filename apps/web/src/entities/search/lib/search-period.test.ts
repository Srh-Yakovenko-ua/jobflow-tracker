import { describe, expect, it } from 'vitest';

import { dashboardHrefOf, searchPeriodOf } from './search-period';

const SEARCH_ID = '0b7c6f0e-5a7d-4c3e-9f1a-2d4b6c8e0a12';

describe('searchPeriodOf', () => {
  it('takes a search id from the period param', () => {
    expect(searchPeriodOf(SEARCH_ID)).toBe(SEARCH_ID);
  });

  it.each([undefined, 'last-year', [SEARCH_ID]])(
    'falls back to the active search for %j',
    (value) => {
      expect(searchPeriodOf(value)).toBeUndefined();
    },
  );
});

describe('dashboardHrefOf', () => {
  it('opens the dashboard scoped to that search', () => {
    expect(dashboardHrefOf(SEARCH_ID)).toBe(`/analytics?period=${SEARCH_ID}`);
  });
});
