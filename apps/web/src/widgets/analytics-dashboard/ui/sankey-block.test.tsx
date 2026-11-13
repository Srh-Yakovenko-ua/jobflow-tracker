import { screen, waitFor, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import type { HttpResponseResolver } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ACTIVE_SEARCH,
  dashboardRoutes,
  DESIGN_ENDINGS,
  DESIGN_FUNNEL_ROWS,
  type SentRequest,
} from '@/test/analytics-fixtures';
import { errorReply } from '@/test/api-handlers';
import { frameOf } from '@/test/dashboard-frames';
import { advancePastQueryRetries, fakeTimeouts } from '@/test/fake-timeouts';
import { latch } from '@/test/latch';
import { type MotionPreference, stubMotionPreference } from '@/test/motion-preference';
import { push } from '@/test/navigation';
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

const FUNNEL = 'етапи воронки';

const ENDINGS = 'чим закінчились';

const BIGGEST_DROP = 'найбільша втрата';

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

const DETAILED_ROWS = [
  ['відгук', 'не вистачає скілів', '3'],
  ['відгук', 'рівень англійської', '2'],
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

function rowsOf(funnel: HTMLElement): HTMLElement[] {
  return [...funnel.children].filter((row) => row instanceof HTMLElement);
}

function exitItemsOf(row: HTMLElement): HTMLElement[] {
  const exits = within(row).queryByRole('list');
  return exits === null ? [] : within(exits).getAllByRole('listitem');
}

function rowText(row: HTMLElement) {
  return {
    stage: within(row).getAllByRole('link')[0]?.textContent,
    conversion: row.querySelector('p')?.textContent ?? null,
    exits: exitItemsOf(row).map((item) => item.textContent),
  };
}

function itemsText(list: HTMLElement): (string | null)[] {
  return within(list)
    .getAllByRole('listitem')
    .map((item) => item.textContent);
}

async function splitInto(user: ReturnType<typeof renderDashboard>['user']) {
  await screen.findByRole('table', { name: TABLE });
  await user.click(screen.getByRole('switch', { name: SPLIT }));
  await waitFor(async () => {
    expect(tableCells(await screen.findByRole('table', { name: TABLE }))).toEqual(MERGED_ROWS);
  });
}

afterEach(() => {
  vi.useRealTimers();
  MotionGlobalConfig.skipAnimations = true;
});

describe('SankeyBlock', () => {
  it('draws the 54 application search as a funnel: each stage with its count and conversion, where the rest went, how it ended', async () => {
    renderDashboard();
    const funnel = await screen.findByRole('list', { name: FUNNEL });

    expect(rowsOf(funnel).map(rowText)).toEqual(DESIGN_FUNNEL_ROWS);
    expect(rowsOf(funnel).map((row) => within(row).queryByText(BIGGEST_DROP) !== null)).toEqual([
      true,
      false,
      false,
      false,
      false,
    ]);
    expect(itemsText(screen.getByRole('list', { name: ENDINGS }))).toEqual(DESIGN_ENDINGS);
    expect(tableCells(screen.getByRole('table', { name: TABLE }))).toEqual(DESIGN_ROWS);
    expect(screen.getByText('Сіра гілка не твоя провина.').closest('p')?.textContent).toBe(
      'Сіра гілка не твоя провина. 17 компаній не відповіли. Вони не входять у розрахунок конверсій.',
    );
  });

  it('puts no text on a bar, keeps a one application segment visible, and shows the table to a keyboard user', async () => {
    renderDashboard();
    const funnel = await screen.findByRole('list', { name: FUNNEL });
    const table = screen.getByRole('table', { name: TABLE });

    const hidden = [...funnel.querySelectorAll('[aria-hidden="true"]')];
    expect(hidden.length).toBeGreaterThan(10);
    expect(hidden.map((element) => element.textContent)).toEqual(hidden.map(() => ''));
    const segments = [...funnel.querySelectorAll('[aria-hidden="true"] > span')];
    expect(segments).toHaveLength(10);
    expect(segments.every((segment) => segment.className.includes('min-w-1.5'))).toBe(true);
    const reach = [...funnel.querySelectorAll('.bg-data-2')];
    expect(reach.map((bar) => bar.className.includes('min-w-1.5'))).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(frameOf(FRAME).querySelector('canvas')).toBeNull();
    const wrapper = table.parentElement;
    expect(wrapper?.className).toContain('sr-only');
    expect(wrapper?.className).toContain('focus-within:not-sr-only');
    const [link] = within(table).getAllByRole('link', { name: 'відгук' });
    link?.focus();
    expect(document.activeElement).toBe(link);
    expect(link?.className).toContain('min-h-11');
  });

  it('a stage, an exit or a node in the table opens the board filtered to its applications', async () => {
    const { user } = renderDashboard();
    const table = await screen.findByRole('table', { name: TABLE });

    await user.click(within(table).getAllByRole('link', { name: "техінтерв'ю" })[0] ?? table);
    expect(push).toHaveBeenLastCalledWith('/board?stage=tech_interview');
    await user.click(screen.getByRole('link', { name: 'скринінг 17' }));
    expect(push).toHaveBeenLastCalledWith('/board?stage=screening');
    await user.click(screen.getByRole('link', { name: 'відмова 21' }));
    expect(push).toHaveBeenLastCalledWith('/board?stage=rejected');
  });

  it('hover or keyboard focus on an exit shows its flow, the stage counts and the Wilson interval; a stage link is 44 px and dims the other rows', async () => {
    const { user } = renderDashboard();
    const funnel = await screen.findByRole('list', { name: FUNNEL });

    await user.hover(screen.getByRole('link', { name: 'відмова 21' }));
    const tooltip = await screen.findByRole('tooltip');
    expect([...tooltip.children].map((line) => line.textContent)).toEqual([
      'відгук → відмова 21',
      'дійшло 54, пройшло 17',
      'конверсія відгук → скринінг: 43% (29–58%)',
    ]);
    await user.unhover(screen.getByRole('link', { name: 'відмова 21' }));
    const stage = screen.getByRole('link', { name: 'фінал 4' });
    stage.focus();
    await user.tab();
    expect((await screen.findByRole('tooltip')).firstElementChild?.textContent).toBe(
      'фінал → відкликав 1',
    );
    const [, , , final] = rowsOf(funnel);
    expect(final?.contains(document.activeElement)).toBe(true);
    expect(stage.className).toContain('min-h-11');
    expect(funnel.className).toContain('group/funnel');
    expect(final?.className).toContain(
      'group-has-[:focus-visible]/funnel:not-has-[:focus-visible]:[&_[aria-hidden]]:opacity-55',
    );
    expect(final?.className).toContain('[&_[aria-hidden]]:transition-opacity');
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
    expect(screen.getByRole('button', { name: 'інші 2' })).toBeDefined();
    expect(itemsText(screen.getByRole('list', { name: ENDINGS }))).toEqual([
      'у процесі 375',
      'відмова 5',
    ]);
    expect(screen.queryByText('Сіра гілка не твоя провина.')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'показати всі причини' }));

    expect(tableCells(await screen.findByRole('table', { name: TABLE }))).toEqual(DETAILED_ROWS);
    expect(screen.queryByRole('button', { name: 'показати всі причини' })).toBeNull();
  });

  it('the "інші" exit expands the small reasons in place', async () => {
    const { user } = renderDashboard();
    await splitInto(user);

    await user.click(screen.getByRole('button', { name: 'інші 2' }));

    expect(tableCells(await screen.findByRole('table', { name: TABLE }))).toEqual(DETAILED_ROWS);
    expect(screen.getByRole('link', { name: 'рівень англійської 2' })).toBeDefined();
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

  it.each<{ preference: MotionPreference; grows: boolean }>([
    { preference: 'no-preference', grows: true },
    { preference: 'reduce', grows: false },
  ])('bars grow from zero on enter unless motion is $preference', async ({ preference, grows }) => {
    MotionGlobalConfig.skipAnimations = false;
    stubMotionPreference(preference);
    renderDashboard();
    const funnel = await screen.findByRole('list', { name: FUNNEL });

    const bars = [...funnel.querySelectorAll<HTMLElement>('.origin-left')];
    expect(bars.length).toBeGreaterThan(5);
    expect(bars.every((bar) => bar.style.transform.startsWith('scaleX(0'))).toBe(grows);
  });
});
