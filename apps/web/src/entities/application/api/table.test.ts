import type { ApplicationFilters } from '@jobflow/shared';
import { QueryClient } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { latch } from '@/test/latch';
import { listItemsIn, pagedListRoute } from '@/test/list-fixtures';
import { server } from '@/test/server';

import { applicationTableQueryOptions } from './table';

const ITEMS = listItemsIn({ stage: 'screening', count: 5, from: 1 });

type TableLoad = { filters?: ApplicationFilters; signal?: AbortSignal };

function loadTable({ filters = {}, signal = new AbortController().signal }: TableLoad = {}) {
  const { queryKey, queryFn } = applicationTableQueryOptions(filters);
  if (queryFn === undefined) {
    throw new Error('the table query has no queryFn');
  }
  return queryFn({ client: new QueryClient(), queryKey, signal, meta: undefined });
}

describe('applicationTableQueryOptions', () => {
  it('joins three pages in order, each asked with the filters, 100 rows, the newest event first and the cursor of the page before', async () => {
    const route = pagedListRoute({ items: ITEMS, pageSize: 2 });
    server.use(route.handler);

    const rows = await loadTable({ filters: { stage: ['screening'], q: 'react' } });

    expect(rows.map((row) => row.position)).toEqual([
      'Vacancy 1',
      'Vacancy 2',
      'Vacancy 3',
      'Vacancy 4',
      'Vacancy 5',
    ]);
    expect(route.sent).toEqual([
      'stage=screening&q=react&limit=100&sort=-lastEventAt',
      'stage=screening&q=react&limit=100&sort=-lastEventAt&cursor=2',
      'stage=screening&q=react&limit=100&sort=-lastEventAt&cursor=4',
    ]);
  });

  it('one page with no next cursor is one request', async () => {
    const route = pagedListRoute({ items: ITEMS });
    server.use(route.handler);

    expect(await loadTable()).toHaveLength(5);
    expect(route.sent).toEqual(['limit=100&sort=-lastEventAt']);
  });

  it('an abort while a page loads stops the loop before the next page is asked for', async () => {
    const held = latch();
    const route = pagedListRoute({ items: ITEMS, pageSize: 2, latch: held });
    server.use(route.handler);
    const controller = new AbortController();

    const loading = loadTable({ signal: controller.signal });
    await waitFor(() => {
      expect(route.sent).toHaveLength(1);
    });
    controller.abort();
    held.release();

    await expect(loading).rejects.toMatchObject({ name: 'AbortError' });
    expect(route.sent).toHaveLength(1);
  });
});
