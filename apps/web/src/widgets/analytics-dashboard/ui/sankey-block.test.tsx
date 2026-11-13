import { act, screen, waitFor, within } from '@testing-library/react';
import type { HttpResponseResolver } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ACTIVE_SEARCH,
  dashboardRoutes,
  DESIGN_NODE_LABELS,
  type SentRequest,
} from '@/test/analytics-fixtures';
import { errorReply } from '@/test/api-handlers';
import { frameOf } from '@/test/dashboard-frames';
import { advancePastQueryRetries, fakeTimeouts } from '@/test/fake-timeouts';
import { latch } from '@/test/latch';
import { stubMotionPreference } from '@/test/motion-preference';
import { push } from '@/test/navigation';
import { lastDrawnChart } from '@/test/recorded-chart';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';
import { meRoute } from '@/test/session-fixtures';
import { tableCells } from '@/test/table-rows';

import { AnalyticsDashboard } from './analytics-dashboard';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('next/link', () => import('@/test/link'));
vi.mock('react-chartjs-2', () => import('@/test/recorded-chart'));

const TABLE = 'Воронка відгуків';

const FRAME = 'головне · воронка цілком';

const SPLIT = 'розбити відмови за причинами';

const DESIGN_ROWS = [
  ['відгук', 'скринінг', '17'],
  ['відгук', 'відмова', '21'],
  ['відгук', 'ghosted', '14'],
  ['відгук', 'відкликав', '2'],
  ['скринінг', "техінтерв'ю", '9'],
  ['скринінг', 'відмова', '5'],
  ['скринінг', 'ghosted', '2'],
  ['скринінг', 'відкликав', '1'],
  ["техінтерв'ю", 'фінал', '4'],
  ["техінтерв'ю", 'відмова', '4'],
  ["техінтерв'ю", 'ghosted', '1'],
  ['фінал', 'офер', '1'],
  ['фінал', 'відмова', '2'],
  ['фінал', 'відкликав', '1'],
];

const MERGED_ROWS = [
  ['відгук', 'не вистачає скілів', '3'],
  ['відгук', 'інші', '2'],
  ['відгук', 'у процесі', '375'],
];

function splitAsked(request: Request): boolean {
  return new URL(request.url).searchParams.get('split') === 'reason';
}

function renderDashboard(sankey?: HttpResponseResolver) {
  const routes = dashboardRoutes(sankey === undefined ? {} : { sankey });
  server.use(meRoute(), ...routes.handlers);
  return { user: renderInApp(<AnalyticsDashboard />), sent: routes.sent };
}

function sankeyQueries(sent: readonly SentRequest[]) {
  return sent.filter(({ route }) => route === 'sankey').map(({ url }) => url.search);
}

afterEach(() => {
  vi.useRealTimers();
});

describe('SankeyBlock', () => {
  it('draws the 54 application search as designed: node labels with counts, one table row per flow, the ghost note', async () => {
    renderDashboard();

    expect(tableCells(await screen.findByRole('table', { name: TABLE }))).toEqual(DESIGN_ROWS);
    expect(lastDrawnChart().data.datasets[0]?.labels).toEqual(DESIGN_NODE_LABELS);
    expect(screen.getByText('Сіра гілка не твоя провина.').closest('p')?.textContent).toBe(
      'Сіра гілка не твоя провина. 17 компаній не відповіли. Вони не входять у розрахунок конверсій.',
    );
    const legend = within(frameOf(FRAME)).getByRole('list');
    expect(
      within(legend)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['відмова', 'ghosted', 'відкликав', 'офер']);
  });

  it('hides the canvas from screen readers and shows the table to a keyboard user who tabs into it', async () => {
    renderDashboard();
    const table = await screen.findByRole('table', { name: TABLE });

    expect(frameOf(FRAME).querySelector('canvas')?.getAttribute('aria-hidden')).toBe('true');
    const wrapper = table.parentElement;
    expect(wrapper?.className).toContain('sr-only');
    expect(wrapper?.className).toContain('focus-within:not-sr-only');
    const [link] = within(table).getAllByRole('link', { name: 'відгук' });
    link?.focus();
    expect(document.activeElement).toBe(link);
    expect(link?.className).toContain('min-h-11');
    expect(link?.className).toContain('min-w-11');
  });

  it('a node in the table opens the board filtered to its applications', async () => {
    const { user } = renderDashboard();
    const table = await screen.findByRole('table', { name: TABLE });

    await user.click(within(table).getAllByRole('link', { name: "техінтерв'ю" })[0] ?? table);

    expect(push).toHaveBeenLastCalledWith('/board?stage=tech_interview');
  });

  it('the split switch asks for reasons while staying focused, then folds small reasons into "інші" that expand on demand', async () => {
    const held = latch();
    const { user, sent } = renderDashboard(async ({ request }) => {
      if (splitAsked(request)) await held.reached;
      return undefined;
    });
    await screen.findByRole('table', { name: TABLE });
    sent.length = 0;

    await user.click(screen.getByRole('switch', { name: SPLIT }));

    await waitFor(() => {
      expect(sankeyQueries(sent)).toEqual([`?searchId=${ACTIVE_SEARCH.id}&split=reason`]);
    });
    const toggle = screen.getByRole('switch', { name: SPLIT });
    expect(document.activeElement).toBe(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(frameOf(FRAME).querySelector('[aria-busy="true"]')).not.toBeNull();
    held.release();
    await waitFor(async () => {
      expect(tableCells(await screen.findByRole('table', { name: TABLE }))).toEqual(MERGED_ROWS);
    });
    expect(lastDrawnChart().data.datasets[0]?.labels?.other).toBe('інші 2');
    expect(screen.queryByText('Сіра гілка не твоя провина.')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'показати всі причини' }));

    expect(tableCells(await screen.findByRole('table', { name: TABLE }))).toEqual([
      ['відгук', 'не вистачає скілів', '3'],
      ['відгук', 'рівень англійської', '2'],
      ['відгук', 'у процесі', '375'],
    ]);
    expect(screen.queryByRole('button', { name: 'показати всі причини' })).toBeNull();
  });

  it('a failed split request keeps the switch, and switching it off brings the whole funnel back', async () => {
    fakeTimeouts();
    const { user } = renderDashboard(({ request }) =>
      splitAsked(request) ? errorReply({ status: 500, type: 'internal_error' }) : undefined,
    );
    await screen.findByRole('table', { name: TABLE });

    await user.click(screen.getByRole('switch', { name: SPLIT }));
    await advancePastQueryRetries();

    await waitFor(() => {
      expect(within(frameOf(FRAME)).queryByRole('alert')).not.toBeNull();
    });
    await user.click(screen.getByRole('switch', { name: SPLIT }));

    await waitFor(async () => {
      expect(tableCells(await screen.findByRole('table', { name: TABLE }))).toEqual(DESIGN_ROWS);
    });
    expect(screen.getByRole('switch', { name: SPLIT }).getAttribute('aria-checked')).toBe('false');
  });

  it('enters with the token animation and draws at once under reduced motion', async () => {
    renderDashboard();
    await screen.findByRole('table', { name: TABLE });
    expect(lastDrawnChart().options?.animation).toBeUndefined();

    act(() => {
      stubMotionPreference('reduce');
    });

    await waitFor(() => {
      expect(lastDrawnChart().options?.animation).toBe(false);
    });
  });
});
