import { focusManager, type QueryStatus } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw/http';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { applicationKeys } from '@/entities/application';
import { uk } from '@/shared/i18n';
import { apiUrl, errorReply, OUTAGES } from '@/test/api-handlers';
import {
  boardRoute,
  type BoardRouteOptions,
  cardIn,
  DESIGN_BOARD,
  DESIGN_BOARD_HEADINGS,
} from '@/test/board-fixtures';
import { QueryProbe, waitForQuery } from '@/test/query-status';
import { columnNamed, renderBoard } from '@/test/render-board';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';
import { meRoute } from '@/test/session-fixtures';

import { KanbanBoard } from './kanban-board';

const BOARD = uk.board;

const BOARD_KEY = applicationKeys.board({});

const BOARD_URL = apiUrl('/applications/board');

const FINAL_ONLY_BOARD: BoardRouteOptions = {
  counts: { final: 1 },
  cards: [cardIn({ serial: 107, stage: 'final', position: 'Lead Frontend Engineer' })],
};

const SETTLED_STATE: Record<Exclude<QueryStatus, 'success'>, { role: string; text: string }> = {
  error: { role: 'alert', text: uk.states.errors.loadFailed.title },
  pending: { role: 'status', text: uk.ui.loading },
};

const RETRY = uk.states.errors.loadFailed.action;

function expandFailsRoute() {
  return http.get(BOARD_URL, ({ request }) =>
    new URL(request.url).searchParams.has('expand')
      ? errorReply({ status: 500, type: 'internal_error' })
      : undefined,
  );
}

function headingsNamed(names: readonly string[]): HTMLElement[] {
  return names.map((name) => screen.getByRole('heading', { level: 2, name }));
}

async function openFailingRejectedLane() {
  const { user } = renderBoard(DESIGN_BOARD);
  const strip = await screen.findByRole('button', { name: 'відмова 32' });
  server.use(expandFailsRoute());
  await user.click(strip);
  const lane = within(columnNamed('відмова 32'));
  const retry = await lane.findByRole('button', { name: RETRY }, { timeout: 2500 });
  return { user, strip, lane, retry };
}

afterEach(() => {
  focusManager.setFocused(undefined);
  vi.useRealTimers();
});

describe('KanbanBoard', () => {
  it('heads the five open columns in stage order with the full count, then the three outcome strips, under the count of cards in work', async () => {
    renderBoard({
      ...DESIGN_BOARD,
      counts: { applied: 8, screening: 5, tech_interview: 3, final: 1, offer: 1 },
    });
    await screen.findByText('Senior Frontend Engineer');

    expect(screen.getByText('активний пошук · 17 карточок в роботі')).toBeDefined();
    expect(screen.getAllByRole('heading', { level: 2 })).toEqual(
      headingsNamed([
        'відгук 8',
        'скринінг 5',
        "техінтерв'ю 3",
        'фінал 1',
        'офер 1',
        'відмова 0',
        'ghosted 0',
        'відкликав 0',
      ]),
    );
  });

  it('on the 54-card board keeps відмова, ghosted and відкликав folded into strips with their counts, 4 cards in work', async () => {
    renderBoard(DESIGN_BOARD);
    await screen.findByText('Senior Frontend Engineer');

    expect(screen.getByText('активний пошук · 4 карточки в роботі')).toBeDefined();
    for (const name of ['відмова 32', 'ghosted 17', 'відкликав 0']) {
      expect(screen.getByRole('button', { name }).getAttribute('aria-expanded')).toBe('false');
    }
    expect(screen.queryByText('Middle QA Engineer')).toBeNull();
  });

  it('a click opens відмова into a column with its cards through expand=rejected, focus kept on the same button', async () => {
    const { user, sent } = renderBoard(DESIGN_BOARD);
    const strip = await screen.findByRole('button', { name: 'відмова 32' });

    await user.click(strip);

    expect(await screen.findByText('Middle QA Engineer')).toBeDefined();
    expect(sent).toEqual(['', 'expand=rejected']);
    expect(screen.getByRole('button', { name: 'відмова 32' })).toBe(strip);
    expect(strip.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(strip);
  });

  it('Enter opens the focused strip and Space folds it back, focus staying on it', async () => {
    const { user } = renderBoard(DESIGN_BOARD);
    const strip = await screen.findByRole('button', { name: 'відмова 32' });

    act(() => {
      strip.focus();
    });
    expect(document.activeElement).toBe(strip);
    await user.keyboard('{Enter}');
    await screen.findByText('Middle QA Engineer');
    expect(strip.getAttribute('aria-expanded')).toBe('true');
    await user.keyboard(' ');

    expect(strip.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Middle QA Engineer')).toBeNull();
    expect(document.activeElement).toBe(strip);
  });

  it('when opening відмова fails the board stays, the lane offers a retry, and a second click folds it with focus kept', async () => {
    const { user, strip, lane } = await openFailingRejectedLane();

    expect(screen.getAllByRole('heading', { level: 2 })).toEqual(
      headingsNamed(DESIGN_BOARD_HEADINGS),
    );
    expect(screen.getByText('Senior Frontend Engineer')).toBeDefined();
    await user.click(strip);

    expect(strip.getAttribute('aria-expanded')).toBe('false');
    expect(lane.queryByRole('button', { name: RETRY })).toBeNull();
    expect(document.activeElement).toBe(strip);
  });

  it('the retry inside a failed відмова lane brings its cards in', async () => {
    const { user, lane, retry } = await openFailingRejectedLane();

    server.use(boardRoute(DESIGN_BOARD).handler);
    await user.click(retry);

    expect(await lane.findByText('Middle QA Engineer')).toBeDefined();
  });

  it('with no cards shows only the відгук column holding the first run state, with no strips and no count of cards in work', async () => {
    renderBoard({ counts: {} });

    await screen.findByRole('heading', { name: BOARD.firstRun.title });
    expect(screen.getAllByRole('heading', { level: 2 })).toEqual(
      headingsNamed(['відгук 0', BOARD.firstRun.title]),
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/активний пошук/)).toBeNull();
  });

  it('the фінал column ends with its note under its cards, and an empty open column says it is empty for now', async () => {
    renderBoard(FINAL_ONLY_BOARD);
    await screen.findByText('Lead Frontend Engineer');

    const final = within(columnNamed('фінал 1'));
    expect(final.getByText(BOARD.finalNote[0])).toBeDefined();
    expect(final.queryByText(BOARD.columnEmpty[0])).toBeNull();
    expect(within(columnNamed('відгук 0')).getByText(BOARD.columnEmpty[0])).toBeDefined();
  });

  it('an empty фінал column on a busy board keeps only its own note', async () => {
    renderBoard(DESIGN_BOARD);
    await screen.findByText('Senior Frontend Engineer');

    const final = within(columnNamed('фінал 0'));
    expect(final.getByText(BOARD.finalNote[1])).toBeDefined();
    expect(final.queryByText(BOARD.columnEmpty[0])).toBeNull();
  });

  it('asks for the board again when the window regains focus after the data went stale', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { sent } = renderBoard(DESIGN_BOARD);
    await screen.findByText('Senior Frontend Engineer');

    vi.setSystemTime(Date.now() + 31_000);
    act(() => {
      focusManager.setFocused(true);
    });

    await waitFor(() => {
      expect(sent).toEqual(['', '']);
    });
  });

  it.each(OUTAGES)('while the board API $name it shows the $settled state', async (outage) => {
    server.use(meRoute(), http.get(BOARD_URL, outage.reply));
    renderInApp(
      <>
        <KanbanBoard />
        <QueryProbe queryKey={BOARD_KEY} />
      </>,
    );
    await waitForQuery({ queryKey: BOARD_KEY, status: outage.settled });

    const state = SETTLED_STATE[outage.settled];
    expect(screen.getByText(state.text).closest('[role]')?.getAttribute('role')).toBe(state.role);
  });

  it('the retry on the load-failed panel brings the board in', async () => {
    server.use(
      meRoute(),
      http.get(BOARD_URL, () => errorReply({ status: 500, type: 'internal_error' })),
    );
    const user = renderInApp(<KanbanBoard />);
    await screen.findByRole('alert', {}, { timeout: 2500 });

    server.use(boardRoute(DESIGN_BOARD).handler);
    await user.click(screen.getByRole('button', { name: uk.states.errors.loadFailed.action }));

    expect(await screen.findByText('Senior Frontend Engineer')).toBeDefined();
  });
});
