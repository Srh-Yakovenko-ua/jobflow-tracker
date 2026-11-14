import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACTIVE_SEARCH,
  ARCHIVED_SEARCH,
  DASHBOARD_ROUTES,
  type DashboardRoute,
  dashboardRoutes,
  type DashboardRoutesOptions,
  lowDataFunnel,
  type SentRequest,
} from '@/test/analytics-fixtures';
import { OUTAGES } from '@/test/api-handlers';
import { frameOf, selectArchivedSearch } from '@/test/dashboard-frames';
import { advancePastQueryRetries, fakeTimeouts } from '@/test/fake-timeouts';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';
import { meRoute } from '@/test/session-fixtures';
import { NO_SUMMARY, READY_SUMMARY, summaryRoutes } from '@/test/summary-fixtures';

import { AnalyticsDashboard } from './analytics-dashboard';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('react-chartjs-2', () => import('@/test/recorded-chart'));

const FRAMES = {
  sankey: 'головне · воронка цілком',
  reasons: 'причини відмов за етапами',
  sources: 'конверсія за джерелами',
  resumeAb: 'A/B версій резюме',
  forecast: 'прогноз офера',
  timings: 'час на етапах · медіана',
} as const;

const TILES = {
  sent: 'Відгуків надіслано',
  screening: 'Дійшли до скринінгу',
  response: 'Медіана відповіді',
  ghost: 'Ghost rate',
} as const;

type FrameBlock = keyof typeof FRAMES;

type TileBlock = keyof typeof TILES;

type Block = FrameBlock | TileBlock;

type BlockState = 'ready' | 'failed' | 'loading';

const BLOCKS: readonly Block[] = [
  'sankey',
  'reasons',
  'sources',
  'forecast',
  'sent',
  'screening',
  'response',
  'ghost',
];

const TOASTER = 'Сповіщення';

const HERO_TITLE = 'Куди пішли всі 54 відгуки';

const WHAT_TO_DO = 'що зробити';

const ADD_LINK = 'Додати вакансію';

const AFFECTED: Record<Exclude<DashboardRoute, 'insights'>, readonly Block[]> = {
  searches: ['sankey', 'sent', 'screening'],
  funnel: ['sent', 'screening'],
  sankey: ['sankey'],
  reasons: ['reasons'],
  sources: ['sources'],
  timings: ['response', 'ghost'],
  forecast: ['forecast'],
};

const RETRIED: Partial<Record<DashboardRoute, readonly DashboardRoute[]>> = {
  searches: ['funnel', 'sankey', 'searches'],
};

const OUTAGE_CASES = DASHBOARD_ROUTES.flatMap((route) =>
  route === 'insights' ? [] : OUTAGES.map((outage) => ({ route, blocks: AFFECTED[route], outage })),
);

function renderDashboard(options: DashboardRoutesOptions = {}, latest = NO_SUMMARY) {
  const routes = dashboardRoutes(options);
  server.use(meRoute(), ...summaryRoutes({ latest }).handlers, ...routes.handlers);
  const user = renderInApp(<AnalyticsDashboard />);
  return { user, sent: routes.sent };
}

function isTile(block: Block): block is TileBlock {
  return Object.hasOwn(TILES, block);
}

function blockOf(block: Block): HTMLElement {
  if (isTile(block)) return screen.getByRole('group', { name: TILES[block] });
  return frameOf(FRAMES[block]);
}

function stateOf(element: HTMLElement): BlockState {
  if (within(element).queryByRole('alert') !== null) return 'failed';
  return element.querySelector('[aria-busy="true"]') === null ? 'ready' : 'loading';
}

function statesOfBlocks() {
  return BLOCKS.map((block) => [block, stateOf(blockOf(block))]);
}

function expectedStates(affected: readonly Block[], state: BlockState) {
  return BLOCKS.map((block) => [block, affected.includes(block) ? state : 'ready']);
}

function blockRegions() {
  return screen.queryAllByRole('region', { name: (name) => !name.startsWith(TOASTER) });
}

function queriesOf(sent: readonly SentRequest[]) {
  return Object.fromEntries(sent.map(({ route, url }) => [route, url.search]));
}

beforeEach(() => {
  fakeTimeouts();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AnalyticsDashboard', () => {
  it('the 54 application search reads as the design: header, KPI row and conclusion titles', async () => {
    renderDashboard();

    expect(await screen.findByRole('heading', { name: HERO_TITLE })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Де ти втрачаєш можливості' })).toBeDefined();
    expect(await screen.findByText('аналітика воронки · 12 тижнів')).toBeDefined();
    const sent = within(blockOf('sent'));
    expect(sent.getByText('54')).toBeDefined();
    expect(sent.getByText('+4')).toBeDefined();
    expect(sent.getByText('4,5 на тиждень')).toBeDefined();
    const screening = within(blockOf('screening'));
    expect(screening.getByText('43%')).toBeDefined();
    expect(screening.getByText('17 із 40')).toBeDefined();
    const response = within(await waitFor(() => blockOf('response')));
    expect(await response.findByText('6')).toBeDefined();
    expect(response.getByText('днів')).toBeDefined();
    expect(response.getByText('поріг тиші: 12 днів')).toBeDefined();
    const ghost = within(blockOf('ghost'));
    expect(ghost.getByText('31%')).toBeDefined();
    expect(ghost.getByText('+9 п.п.')).toBeDefined();
    expect(ghost.getByText('ринок: 18–22%')).toBeDefined();
  });

  it('block titles are the conclusions from the insights, forecast and timings keep only the eyebrow, salary and the AI summary are absent', async () => {
    renderDashboard();

    expect(
      await screen.findByRole('heading', {
        name: "На техінтерв'ю тебе найчастіше валять: «не вистачає скілів»",
      }),
    ).toBeDefined();
    expect(
      screen.getByRole('heading', { name: "LinkedIn з'їдає час, рефералки — ні" }),
    ).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Схоже, CV v2 працює краще' })).toBeNull();
    expect(screen.getByRole('region', { name: FRAMES.forecast })).toBeDefined();
    expect(screen.queryByRole('region', { name: FRAMES.timings })).toBeNull();
    expect(screen.getByRole('region', { name: WHAT_TO_DO })).toBeDefined();
    expect(blockRegions()).toHaveLength(5);
    expect(screen.queryByRole('heading', { name: /зарплат/i })).toBeNull();
    expect(screen.queryByText(/саммарі/i)).toBeNull();
  });

  it('a done monthly summary takes the place of the insight actions', async () => {
    renderDashboard({}, READY_SUMMARY);
    await screen.findByRole('heading', { name: HERO_TITLE });

    await waitFor(() => {
      expect(screen.queryByRole('region', { name: WHAT_TO_DO })).toBeNull();
    });
    expect(blockRegions()).toHaveLength(4);
  });

  it('without insights the blocks ask neutral questions instead of stating conclusions', async () => {
    renderDashboard({ insights: { insights: [], actions: [] } });
    await screen.findByRole('heading', { name: HERO_TITLE });
    await waitFor(() => {
      expect(screen.queryByText(WHAT_TO_DO)).toBeNull();
    });

    expect(screen.getByRole('heading', { name: 'Де відмовляють найчастіше' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Яке джерело працює' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Яка версія CV працює краще' })).toBeNull();
  });

  it('four applications turn the whole dashboard into its low data state with one useful action', async () => {
    renderDashboard({ funnel: lowDataFunnel() });

    const meter = await screen.findByRole('meter', { name: 'Прогрес до першого висновку' });
    expect(meter.getAttribute('aria-valuenow')).toBe('4');
    expect(meter.getAttribute('aria-valuemax')).toBe('10');
    expect(screen.getByText('4 / 10')).toBeDefined();
    expect(within(blockOf('sent')).getByText('4')).toBeDefined();
    expect(screen.getByText('перший тиждень')).toBeDefined();
    expect(screen.getByText('буде на 10 відгуках')).toBeDefined();
    expect(screen.getByText("З'явиться після 15 відгуків")).toBeDefined();
    expect(screen.getByText(/^Додати ще 6 відгуків цього тижня\./)).toBeDefined();
    expect(screen.getByRole('link', { name: 'Додати вакансію' }).getAttribute('href')).toBe('/add');
    expect(blockRegions()).toHaveLength(0);
    expect(screen.queryByText(WHAT_TO_DO)).toBeNull();
    expect(screen.queryByRole('group', { name: TILES.screening })).toBeNull();
  });

  it('an archived search in its low data state offers no link to add an application', async () => {
    const { user } = renderDashboard({ funnel: lowDataFunnel() });
    expect(await screen.findByRole('link', { name: ADD_LINK })).toBeDefined();

    await selectArchivedSearch(user);

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: ADD_LINK })).toBeNull();
    });
    expect(screen.getByRole('meter', { name: 'Прогрес до першого висновку' })).toBeDefined();
  });

  it('the current search sends funnel and sankey with the active id, the rest with no search, and the archived one scopes every search request', async () => {
    const { user, sent } = renderDashboard();
    await screen.findByRole('heading', { name: HERO_TITLE });
    const active = `?searchId=${ACTIVE_SEARCH.id}`;
    const archived = `?searchId=${ARCHIVED_SEARCH.id}`;

    await waitFor(() => {
      expect(queriesOf(sent)).toEqual({
        searches: '',
        funnel: active,
        sankey: active,
        reasons: '',
        sources: '',
        timings: '',
        forecast: '',
        insights: '',
      });
    });
    sent.length = 0;
    await selectArchivedSearch(user);

    await waitFor(() => {
      expect(queriesOf(sent)).toEqual({
        funnel: archived,
        sankey: archived,
        reasons: archived,
        sources: archived,
        timings: archived,
        forecast: archived,
        insights: archived,
      });
    });
  });

  it.each(OUTAGE_CASES)(
    'when $route $outage.name only $blocks wait or fail, the rest stay ready, and a retry asks that route again',
    async ({ route, blocks, outage }) => {
      const down = { on: true };
      const { user, sent } = renderDashboard({
        [route]: (info: Parameters<typeof outage.reply>[0]) =>
          down.on ? outage.reply(info) : undefined,
      });
      if (outage.settled === 'pending') {
        await waitFor(() => {
          expect(statesOfBlocks()).toEqual(expectedStates(blocks, 'loading'));
        });
      }
      await advancePastQueryRetries();
      await waitFor(() => {
        expect(statesOfBlocks()).toEqual(expectedStates(blocks, 'failed'));
      });
      const [first] = blocks;
      if (first === undefined) throw new Error('a route without blocks');
      down.on = false;
      sent.length = 0;
      await user.click(within(blockOf(first)).getByRole('button', { name: 'Спробувати ще раз' }));

      await waitFor(() => {
        expect(statesOfBlocks()).toEqual(expectedStates([], 'ready'));
      });
      expect([...new Set(sent.map((request) => request.route))].sort()).toEqual(
        RETRIED[route] ?? [route],
      );
    },
  );
});
