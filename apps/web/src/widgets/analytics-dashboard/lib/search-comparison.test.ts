import { describe, expect, it } from 'vitest';

import { ACTIVE_SEARCH, ARCHIVED_SEARCH, FIRST_SEARCH } from '@/test/analytics-fixtures';

import { searchComparisonOf } from './search-comparison';

describe('searchComparisonOf', () => {
  it('compares the active search with the first archived one in the order the API gives', () => {
    expect(searchComparisonOf([ACTIVE_SEARCH, ARCHIVED_SEARCH, FIRST_SEARCH])).toEqual({
      current: ACTIVE_SEARCH,
      previous: ARCHIVED_SEARCH,
    });
    expect(searchComparisonOf([FIRST_SEARCH, ACTIVE_SEARCH, ARCHIVED_SEARCH])).toEqual({
      current: ACTIVE_SEARCH,
      previous: FIRST_SEARCH,
    });
  });

  it('has nothing to compare without an archived search', () => {
    expect(searchComparisonOf([ACTIVE_SEARCH])).toBeNull();
  });

  it('has nothing to compare without an active search', () => {
    expect(searchComparisonOf([ARCHIVED_SEARCH, FIRST_SEARCH])).toBeNull();
  });
});
