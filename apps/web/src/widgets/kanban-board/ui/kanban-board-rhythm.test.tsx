import type { RhythmResponse } from '@jobflow/shared';
import { buildForecast } from '@jobflow/shared/testing';
import { screen, waitFor, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import type { HttpResponseResolver } from 'msw';
import { http, HttpResponse } from 'msw/http';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { userKeys } from '@/entities/user';
import { SEARCHES } from '@/test/analytics-fixtures';
import {
  analyticsUrl,
  apiUrl,
  NEVER_ANSWERS,
  recordSentRequests,
  REFUSED_CONNECTION,
} from '@/test/api-handlers';
import { DESIGN_BOARD } from '@/test/board-fixtures';
import { flagSwitch } from '@/test/feature-flags';
import { stubMotionPreference } from '@/test/motion-preference';
import { waitForQuery } from '@/test/query-status';
import { renderBoard } from '@/test/render-board';
import {
  buildRhythm,
  DESIGN_DOTS,
  RHYTHM_GOAL_OFF,
  RHYTHM_URL,
  rhythmRoute,
} from '@/test/rhythm-fixtures';
import { server } from '@/test/server';
import { settingsRoutes } from '@/test/settings-fixtures';

vi.mock('next/link', () => import('@/test/link'));
vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock(import('@/shared/config'), async (importOriginal) => {
  const { switchableConfig } = await import('@/test/feature-flags');
  return switchableConfig(importOriginal);
});

const RHYTHM_KEY = userKeys.rhythm();

const FIRST_COLUMN = { name: 'відгук 2' } as const;

const WIDGET = {
  name: 'Цей тиждень: 5 із 8 відгуків, 2 фоллоу-апи; у ритмі 3 з 8 останніх тижнів.',
} as const;

const ANY_WIDGET = { name: /^Цей тиждень|^Пауза до/ } as const;

const SUGGESTED = buildRhythm({ goal: { applications: 5, followups: null }, suggestedGoal: 8 });

const SUGGESTED_WIDGET = {
  name: 'Цей тиждень: 5 із 5 відгуків, 2 фоллоу-апи; у ритмі 3 з 8 останніх тижнів.',
} as const;

const EFFECT = '8 відгуків на тиждень наблизять офер приблизно на 2 тижні.';

const POPOVER = { name: 'Ритм тижня' } as const;

const forecastReply: HttpResponseResolver = ({ request }) =>
  HttpResponse.json(
    new URL(request.url).searchParams.get('applicationsPerWeek') === '8'
      ? { ...buildForecast(), medianWeeks: 2.2 }
      : buildForecast(),
  );

type RhythmBoardSetup = {
  rhythm?: RhythmResponse | HttpResponseResolver;
  forecast?: HttpResponseResolver;
};

async function renderRhythmBoard({
  rhythm = buildRhythm(),
  forecast = forecastReply,
}: RhythmBoardSetup) {
  const reads = { rhythm: 0 };
  const settings = settingsRoutes();
  server.use(
    ...settings.handlers,
    http.get(RHYTHM_URL, () => {
      reads.rhythm += 1;
    }),
    rhythmRoute(rhythm),
    http.get(apiUrl('/searches'), () => HttpResponse.json(SEARCHES)),
    http.get(analyticsUrl('/analytics/forecast'), forecast),
  );
  const { user } = renderBoard(DESIGN_BOARD, { probes: [RHYTHM_KEY] });
  await screen.findByRole('heading', FIRST_COLUMN);
  return { user, reads, patches: settings.patches };
}

async function openSuggestion(setup: RhythmBoardSetup = {}) {
  const board = await renderRhythmBoard({ rhythm: SUGGESTED, ...setup });
  await board.user.click(await screen.findByRole('button', SUGGESTED_WIDGET));
  const popover = within(await screen.findByRole('dialog', POPOVER));
  const accept = async () => {
    await board.user.click(popover.getByRole('button', { name: 'Прийняти ціль' }));
    await waitFor(() => {
      expect(board.patches).toEqual([{ weeklyGoalApplications: 8 }]);
    });
  };
  return { ...board, popover, accept };
}

afterEach(() => {
  flagSwitch.overrides = {};
  MotionGlobalConfig.skipAnimations = true;
});

describe('KanbanBoard weekly rhythm', () => {
  it('reads the week as one sentence while the line, the bar and the dots stay silent', async () => {
    await renderRhythmBoard({});

    const widget = await screen.findByRole('button', WIDGET);

    expect(within(widget).getByText('Цей тиждень: 5 із 8 відгуків · 2 фоллоу-апи')).toBeDefined();
    expect([...widget.children].map((part) => part.getAttribute('aria-hidden'))).toEqual([
      'true',
      'true',
      'true',
    ]);
    expect(within(widget).queryByRole('progressbar')).toBeNull();
    expect(within(widget).queryByRole('img')).toBeNull();
  });

  it('draws eight dots, filled only for the weeks in rhythm and never in a failure colour', async () => {
    await renderRhythmBoard({});

    const dots = [...(await screen.findByRole('button', WIDGET)).querySelectorAll('[data-filled]')];

    expect(dots.map((dot) => dot.getAttribute('data-filled') === 'true')).toEqual(DESIGN_DOTS);
    expect(dots.filter((dot) => /danger|clay|rejected/.test(dot.className))).toEqual([]);
  });

  it('a week past the goal fills the bar to the end and no further', async () => {
    await renderRhythmBoard({
      rhythm: buildRhythm({ goal: { applications: 4, followups: null } }),
    });

    const widget = await screen.findByRole('button', { name: /^Цей тиждень: 5 із 4/ });

    expect(widget.querySelector<HTMLElement>('.origin-left')?.style.width).toBe('100%');
  });

  it.each([
    { preference: 'no-preference', grows: true },
    { preference: 'reduce', grows: false },
  ] as const)(
    'the bar grows from zero unless motion is $preference',
    async ({ preference, grows }) => {
      MotionGlobalConfig.skipAnimations = false;
      stubMotionPreference(preference);
      await renderRhythmBoard({});

      const bar = (await screen.findByRole('button', WIDGET)).querySelector<HTMLElement>(
        '.origin-left',
      );

      expect(bar?.style.width).toBe('62.5%');
      expect(bar?.style.transform.startsWith('scaleX(0')).toBe(grows);
    },
  );

  it('with the goal off the toolbar holds no rhythm widget', async () => {
    await renderRhythmBoard({ rhythm: RHYTHM_GOAL_OFF });
    await waitForQuery({ queryKey: RHYTHM_KEY, status: 'success' });

    expect(screen.queryByRole('button', ANY_WIDGET)).toBeNull();
  });

  it('with the rhythm flag off the board never asks for the rhythm', async () => {
    flagSwitch.overrides = { weeklyRhythm: false };
    const sent = recordSentRequests();
    await renderRhythmBoard({});
    await waitForQuery({ queryKey: userKeys.me(), status: 'success' });

    const paths = sent().map(({ url }) => new URL(url instanceof Request ? url.url : url).pathname);
    expect(paths.filter((path) => path.endsWith('/rhythm'))).toEqual([]);
    expect(screen.queryByRole('button', ANY_WIDGET)).toBeNull();
  });

  it.each([REFUSED_CONNECTION, NEVER_ANSWERS])(
    'when the rhythm $name the board stays whole and the widget stays away',
    async ({ reply, settled }) => {
      await renderRhythmBoard({ rhythm: reply });
      await waitForQuery({ queryKey: RHYTHM_KEY, status: settled });

      expect(screen.getByRole('heading', FIRST_COLUMN)).toBeDefined();
      expect(screen.queryByRole('button', ANY_WIDGET)).toBeNull();
      expect(screen.queryByRole('alert')).toBeNull();
    },
  );

  it('the popover offers the suggested goal with its forecast effect, and accepting saves it once and reads the rhythm again', async () => {
    const { popover, accept, reads } = await openSuggestion();

    expect(popover.getByText('Нова ціль: 8 відгуків на тиждень')).toBeDefined();
    expect(await popover.findByText(EFFECT)).toBeDefined();
    await accept();

    expect(screen.queryByRole('dialog', POPOVER)).toBeNull();
    await waitFor(() => {
      expect(reads.rhythm).toBe(2);
    });
  });

  it('«Не зараз» closes the popover and saves nothing', async () => {
    const { user, popover, patches } = await openSuggestion();

    await user.click(popover.getByRole('button', { name: 'Не зараз' }));

    expect(screen.queryByRole('dialog', POPOVER)).toBeNull();
    expect(patches).toEqual([]);
  });

  it('with analytics down the popover drops the effect sentence and the goal still saves', async () => {
    const { accept } = await openSuggestion({ forecast: () => HttpResponse.error() });

    await accept();

    expect(screen.queryByText(EFFECT)).toBeNull();
  });

  it('with no suggestion the popover only points to the rhythm settings', async () => {
    const { user } = await renderRhythmBoard({});

    await user.click(await screen.findByRole('button', WIDGET));
    const popover = within(await screen.findByRole('dialog', POPOVER));

    expect(popover.getByRole('link', { name: 'Налаштувати ритм' }).getAttribute('href')).toBe(
      '/settings#rhythm',
    );
    expect(popover.queryByRole('button', { name: 'Прийняти ціль' })).toBeNull();
  });
});
