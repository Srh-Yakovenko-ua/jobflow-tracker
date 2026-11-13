import { describe, expect, it } from 'vitest';

import { ACTIVE_SEARCH, ARCHIVED_SEARCH } from '@/test/analytics-fixtures';

import { searchGroupsOf } from './search-groups';

const KYIV = 'Europe/Kyiv';

describe('searchGroupsOf', () => {
  it('lists the current search first by its count and each archived one by its dates', () => {
    expect(searchGroupsOf({ searches: [ARCHIVED_SEARCH, ACTIVE_SEARCH], timeZone: KYIV })).toEqual([
      {
        label: 'поточний пошук',
        options: [{ value: ACTIVE_SEARCH.id, label: 'Мій пошук', meta: '54 відгуки' }],
      },
      {
        label: 'архів',
        options: [
          { value: ARCHIVED_SEARCH.id, label: 'Пошук 2025', meta: '22.09.2025–01.12.2025' },
        ],
      },
    ]);
  });

  it('an archived search without a finish date shows only its start', () => {
    const unfinished = { ...ARCHIVED_SEARCH, finishedAt: null };

    expect(searchGroupsOf({ searches: [unfinished], timeZone: KYIV })).toEqual([
      {
        label: 'архів',
        options: [{ value: unfinished.id, label: 'Пошук 2025', meta: '22.09.2025' }],
      },
    ]);
  });
});
