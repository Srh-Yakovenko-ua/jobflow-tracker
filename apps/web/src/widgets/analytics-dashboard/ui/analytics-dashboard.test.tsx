import { CHART_THEME } from '@jobflow/shared/chart-theme';
import { buildNoSalary } from '@jobflow/shared/testing';
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
  salaryInsightsBody,
  type SentRequest,
} from '@/test/analytics-fixtures';
import { OUTAGES } from '@/test/api-handlers';
import { frameOf, selectArchivedSearch, smallNoteOf } from '@/test/dashboard-frames';
import { advancePastQueryRetries, fakeTimeouts } from '@/test/fake-timeouts';
import { drawnChartIn } from '@/test/recorded-chart';
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
  matchValidation: 'Match Score · перевірка на відгуках',
  salary: 'зарплатна аналітика · твої картки',
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
  'resumeAb',
  'forecast',
  'timings',
  'matchValidation',
  'salary',
  'sent',
  'screening',
  'response',
  'ghost',
];

const TOASTER = 'Сповіщення';

const NBSP = '\u00a0';

const OUTCOME = CHART_THEME.light.outcome;

const HERO_TITLE = 'Куди пішли всі 54 відгуки';

const WHAT_TO_DO = 'що зробити';

const ADD_LINK = 'Додати вакансію';

const AFFECTED: Record<Exclude<DashboardRoute, 'insights'>, readonly Block[]> = {
  searches: ['sankey', 'sent', 'screening'],
  funnel: ['sent', 'screening'],
  sankey: ['sankey'],
  reasons: ['reasons'],
  sources: ['sources'],
  timings: ['timings', 'response', 'ghost'],
  forecast: ['forecast'],
  'resume-ab': ['resumeAb'],
  'match-validation': ['matchValidation'],
  salary: ['salary'],
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

  it('block titles are the conclusions from the insights and the served verdicts, forecast and timings keep only the eyebrow, salary asks its neutral question, the AI summary is absent', async () => {
    renderDashboard();

    expect(
      await screen.findByRole('heading', {
        name: "На техінтерв'ю тебе валять алгоритми",
      }),
    ).toBeDefined();
    expect(
      screen.getByRole('heading', { name: "LinkedIn з'їдає час, рефералки — ні" }),
    ).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Схоже, CV v2 працює краще' })).toBeDefined();
    expect(screen.getByRole('region', { name: FRAMES.forecast })).toBeDefined();
    expect(screen.getByRole('region', { name: FRAMES.timings })).toBeDefined();
    expect(screen.getByRole('region', { name: WHAT_TO_DO })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'На якій вилці приходить офер' })).toBeDefined();
    expect(blockRegions()).toHaveLength(9);
    expect(screen.queryByText(/саммарі/i)).toBeNull();
  });

  it('the salary block sits in the timings row, takes its title from the salary insight and reads the median, the outcome bars and the small sample note', async () => {
    renderDashboard({ insights: salaryInsightsBody() });

    expect(
      await screen.findByRole('heading', {
        name: `Відмови через зарплату: усі на вилках нижче $4${NBSP}500`,
      }),
    ).toBeDefined();
    const salary = blockOf('salary');
    expect(salary.parentElement).toBe(blockOf('timings').parentElement);
    expect(await within(salary).findByText('$4 900 медіана вилки')).toBeDefined();
    expect(within(salary).getByText('3 відгуки без вилки не входять у розрахунок.')).toBeDefined();
    const [median, whisker] = drawnChartIn(salary).data.datasets;
    expect(median?.data).toEqual([5800, 3950, 5050]);
    expect(median?.backgroundColor).toEqual([
      OUTCOME.offer,
      OUTCOME.rejected,
      CHART_THEME.light.data[1],
    ]);
    expect(whisker?.data).toEqual([
      [5800, 5800],
      [3800, 4100],
      [4500, 6000],
    ]);
    expect(smallNoteOf(salary)).toHaveLength(3);
    expect(within(salary).getByRole('table', { name: 'Зарплатні вилки, $ net' })).toBeDefined();
  });

  it('a search without a single salary shows the salary empty copy and no chart', async () => {
    renderDashboard({ salary: buildNoSalary() });

    const salary = blockOf('salary');
    expect(await within(salary).findByText('Вилок ще немає')).toBeDefined();
    expect(salary.querySelector('canvas')).toBeNull();
  });

  it('a done monthly summary takes the place of the insight actions', async () => {
    renderDashboard({}, READY_SUMMARY);
    await screen.findByRole('heading', { name: HERO_TITLE });

    await waitFor(() => {
      expect(screen.queryByRole('region', { name: WHAT_TO_DO })).toBeNull();
    });
    expect(blockRegions()).toHaveLength(8);
  });

  it('without insights the blocks ask neutral questions, the CV block keeps its served verdict', async () => {
    renderDashboard({ insights: { insights: [], actions: [] } });
    await screen.findByRole('heading', { name: HERO_TITLE });
    await waitFor(() => {
      expect(screen.queryByText(WHAT_TO_DO)).toBeNull();
    });

    expect(screen.getByRole('heading', { name: 'Де відмовляють найчастіше' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Яке джерело працює' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Схоже, CV v2 працює краще' })).toBeDefined();
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
        salary: '',
        'resume-ab': '',
        'match-validation': '',
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
        salary: archived,
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
