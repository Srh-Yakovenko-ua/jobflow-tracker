import { screen, within } from '@testing-library/react';
import { http, type HttpHandler } from 'msw/http';
import { describe, expect, it, vi } from 'vitest';

import { ACTIVE_SEARCH, ARCHIVED_SEARCH, FIRST_SEARCH } from '@/test/analytics-fixtures';
import { apiUrl, errorReply } from '@/test/api-handlers';
import { findRetryAfterQueryRetries } from '@/test/query-status';
import { renderInApp } from '@/test/render-in-app';
import { finishSearchRoutes, type FinishSearchRoutesOptions } from '@/test/search-fixtures';
import { server } from '@/test/server';
import { meRoute } from '@/test/session-fixtures';

import { SearchHistory } from './search-history';

vi.mock('next/link', () => import('@/test/link'));

const HISTORY = { name: 'Історія пошуків' } as const;

function renderHistory(options: FinishSearchRoutesOptions = {}, overrides: HttpHandler[] = []) {
  const routes = finishSearchRoutes(options);
  server.use(...overrides, meRoute(), ...routes.handlers);
  return { user: renderInApp(<SearchHistory />) };
}

async function rowsOfHistory() {
  const list = await screen.findByRole('list', HISTORY);
  return within(list).getAllByRole('listitem');
}

describe('SearchHistory', () => {
  it('lists every archived search in API order with its dates, outcome, totals and a way to its dashboard', async () => {
    renderHistory({ searches: { items: [ACTIVE_SEARCH, ARCHIVED_SEARCH, FIRST_SEARCH] } });

    const [archived, first, ...rest] = await rowsOfHistory();
    if (archived === undefined || first === undefined) throw new Error('two rows were expected');
    expect(rest).toEqual([]);
    const row = within(archived);
    expect(row.getByRole('heading', { name: 'Пошук 2025' })).toBeDefined();
    expect(row.getByText('22.09.2025–01.12.2025 · офер прийнято')).toBeDefined();
    expect(row.getByText('31 відгук · 9 співбесід · 1 офер · без оферу · 70 днів')).toBeDefined();
    const dashboard = row.getByRole('link', { name: 'Дашборд' });
    expect(dashboard.getAttribute('href')).toBe(`/analytics?period=${ARCHIVED_SEARCH.id}`);
    expect(dashboard.classList.contains('max-md:min-h-11')).toBe(true);
    expect(within(first).getByRole('heading', { name: 'Перший пошук' })).toBeDefined();
    expect(within(first).getByText('04.03.2024–13.05.2024 · на паузі')).toBeDefined();
    expect(screen.getByRole('heading', { level: 1, ...HISTORY })).toBeDefined();
  });

  it('a search that reached an offer says on which day', async () => {
    renderHistory({ searches: { items: [{ ...ARCHIVED_SEARCH, daysToOffer: 38 }] } });

    const [row] = await rowsOfHistory();
    if (row === undefined) throw new Error('one row was expected');
    expect(
      within(row).getByText('31 відгук · 9 співбесід · 1 офер · офер на 38-й день · 70 днів'),
    ).toBeDefined();
  });

  it('waits on a busy region before the searches arrive', () => {
    renderHistory();

    expect(screen.getByRole('status').closest('[aria-busy="true"]')).not.toBeNull();
  });

  it('with only the current search it says nothing is archived yet', async () => {
    renderHistory({ searches: { items: [ACTIVE_SEARCH] } });

    expect(
      await screen.findByRole('heading', { name: 'Завершених пошуків ще немає' }),
    ).toBeDefined();
    expect(screen.queryByRole('list', HISTORY)).toBeNull();
  });

  it('a failed read shows the error, and its retry brings the history in', async () => {
    const down = { on: true };
    const { user } = renderHistory({}, [
      http.get(apiUrl('/searches'), () =>
        down.on ? errorReply({ status: 500, type: 'internal_error' }) : undefined,
      ),
    ]);

    const retry = await findRetryAfterQueryRetries();
    down.on = false;
    await user.click(retry);

    expect(await rowsOfHistory()).toHaveLength(1);
  });
});
