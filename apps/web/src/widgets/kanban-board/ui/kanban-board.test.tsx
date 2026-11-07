import { focusManager, type QueryStatus } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw/http';
import { delay } from 'msw/utils/delay';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { applicationKeys } from '@/entities/application';
import { uk } from '@/shared/i18n';
import { apiUrl, errorReply, OUTAGES } from '@/test/api-handlers';
import {
  boardRoute,
  type BoardRouteOptions,
  cardIn,
  cardsIn,
  DESIGN_BOARD,
  DESIGN_BOARD_HEADINGS,
} from '@/test/board-fixtures';
import { push } from '@/test/navigation';
import { QueryProbe, waitForQuery } from '@/test/query-status';
import { columnNamed, renderBoard } from '@/test/render-board';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';
import { meRoute } from '@/test/session-fixtures';

import { KanbanBoard } from './kanban-board';

vi.mock('next/navigation', () => import('@/test/navigation'));

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

function skeletonStripClasses(): string[][] {
  const skeleton = screen.getByText(uk.ui.loading).closest('[aria-busy]');
  return [...(skeleton?.querySelectorAll('.flex-none') ?? [])].map((strip) => [...strip.classList]);
}

afterEach(() => {
  focusManager.setFocused(undefined);
  vi.useRealTimers();
  push.mockClear();
});

describe('KanbanBoard', () => {
  it('heads the five open columns in stage order with the full count, then the three outcome strips, under the count of cards in work', async () => {
    renderBoard({
      ...DESIGN_BOARD,
      counts: { applied: 8, screening: 5, tech_interview: 3, final: 1, offer: 1 },
    });
    await screen.findByText('Senior Frontend Engineer');

    expect(screen.getByText('активний пошук · 17 карток у роботі')).toBeDefined();
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

    expect(screen.getByText('активний пошук · 4 картки в роботі')).toBeDefined();
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
    await waitFor(() => {
      expect(screen.queryByText('Middle QA Engineer')).toBeNull();
    });
    expect(document.activeElement).toBe(strip);
  });

  it('folding відмова fades its cards out: they stay, out of reach, until the fade ends', async () => {
    const { user } = renderBoard(DESIGN_BOARD);
    const strip = await screen.findByRole('button', { name: 'відмова 32' });
    await user.click(strip);
    await screen.findByText('Middle QA Engineer');

    fireEvent.click(strip);

    expect(screen.getByText('Middle QA Engineer').closest('[inert]')).toBeInstanceOf(HTMLElement);
    await waitFor(() => {
      expect(screen.queryByText('Middle QA Engineer')).toBeNull();
    });
  });

  it('when opening відмова fails the board stays, the lane offers a retry, and a second click folds it with focus kept', async () => {
    const { user, strip, lane } = await openFailingRejectedLane();

    expect(screen.getAllByRole('alert')).toEqual([lane.getByRole('alert')]);
    expect(screen.getAllByRole('heading', { level: 2 })).toEqual(
      headingsNamed(DESIGN_BOARD_HEADINGS),
    );
    expect(screen.getByText('Senior Frontend Engineer')).toBeDefined();
    await user.click(strip);

    expect(strip.getAttribute('aria-expanded')).toBe('false');
    await waitFor(() => {
      expect(lane.queryByRole('button', { name: RETRY })).toBeNull();
    });
    expect(document.activeElement).toBe(strip);
  });

  it('the retry inside a failed відмова lane brings its cards in', async () => {
    const { user, lane, retry } = await openFailingRejectedLane();

    server.use(boardRoute(DESIGN_BOARD).handler);
    await user.click(retry);

    expect(await lane.findByText('Middle QA Engineer')).toBeDefined();
  });

  it('with no cards fades in only the відгук column holding the first run state, with no strips and no count of cards in work', async () => {
    renderBoard({ counts: {} });

    const firstRun = await screen.findByRole('heading', { name: BOARD.firstRun.title });
    expect(firstRun.closest('.animate-fade-in')).toBeInstanceOf(HTMLElement);
    expect(screen.getAllByRole('heading', { level: 2 })).toEqual(
      headingsNamed(['відгук 0', BOARD.firstRun.title]),
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/активний пошук/)).toBeNull();
  });

  it('with no cards the view switch still opens Таблиця', async () => {
    const { user } = renderBoard({ counts: {} });
    const views = within(await screen.findByRole('radiogroup', { name: 'Подання' }));

    await user.click(views.getByRole('radio', { name: 'Таблиця' }));

    expect(push).toHaveBeenCalledExactlyOnceWith('/applications');
  });

  it('the view switch marks Дошка and opens Таблиця with the filters of the board', async () => {
    const { user } = renderBoard(DESIGN_BOARD, { filters: { source: ['djinni'], q: 'kafka' } });
    const views = within(await screen.findByRole('radiogroup', { name: 'Подання' }));

    expect(views.getByRole('radio', { name: 'Дошка' }).getAttribute('aria-checked')).toBe('true');
    await user.click(views.getByRole('radio', { name: 'Таблиця' }));

    expect(push).toHaveBeenCalledExactlyOnceWith('/applications?source=djinni&q=kafka');
  });

  it('the фінал column ends with its note under its cards, and an empty open column says it is empty for now', async () => {
    renderBoard(FINAL_ONLY_BOARD);
    await screen.findByText('Lead Frontend Engineer');

    const final = within(columnNamed('фінал 1'));
    expect(final.getByText(BOARD.finalNote[0])).toBeDefined();
    expect(final.queryByText(BOARD.columnEmpty[0])).toBeNull();
    expect(within(columnNamed('відгук 0')).getByText(BOARD.columnEmpty[0])).toBeDefined();
  });

  it.each([
    { count: 2, note: BOARD.finalNote[0] },
    { count: 3, note: null },
  ])('a фінал of $count cards shows its note: $note', async ({ count, note }) => {
    renderBoard({ counts: { final: count }, cards: cardsIn({ stage: 'final', count, from: 107 }) });
    await screen.findByText(`Vacancy ${String(106 + count)}`);

    const final = within(columnNamed(`фінал ${String(count)}`));
    expect(final.queryByText(BOARD.finalNote[0])?.textContent ?? null).toBe(note);
    expect(final.queryByText(BOARD.columnEmpty[0])).toBeNull();
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
        <KanbanBoard initial={{ density: 'full' }} />
        <QueryProbe queryKey={BOARD_KEY} />
      </>,
    );
    await waitForQuery({ queryKey: BOARD_KEY, status: outage.settled });

    const state = SETTLED_STATE[outage.settled];
    expect(screen.getByText(state.text).closest('[role]')?.getAttribute('role')).toBe(state.role);
  });

  it('while the board loads its outcome strips are drawn like the real ones: rounded, ghosted on paper with its ring, the other two raised with none', () => {
    server.use(
      meRoute(),
      http.get(BOARD_URL, () => delay('infinite')),
    );
    renderInApp(<KanbanBoard initial={{ density: 'full' }} />);

    const [rejected, ghosted, withdrawn] = skeletonStripClasses();
    expect(ghosted).toEqual(
      expect.arrayContaining(['rounded-2xl', 'bg-paper', 'inset-ring', 'inset-ring-line-soft']),
    );
    expect(rejected).toEqual(expect.arrayContaining(['rounded-2xl', 'bg-surface-3']));
    expect(rejected).not.toContain('inset-ring');
    expect(withdrawn).toEqual(rejected);
  });

  it('the load-failed panel fades in over the skeleton, and its retry brings the board in', async () => {
    server.use(
      meRoute(),
      http.get(BOARD_URL, () => errorReply({ status: 500, type: 'internal_error' })),
    );
    const user = renderInApp(<KanbanBoard initial={{ density: 'full' }} />);
    const failed = await screen.findByRole('alert', {}, { timeout: 2500 });
    expect(failed.closest('.animate-fade-in')).toBeInstanceOf(HTMLElement);

    server.use(boardRoute(DESIGN_BOARD).handler);
    await user.click(screen.getByRole('button', { name: uk.states.errors.loadFailed.action }));

    expect(await screen.findByText('Senior Frontend Engineer')).toBeDefined();
  });
});
