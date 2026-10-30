import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { HttpResponseResolver } from 'msw';
import { http, HttpResponse } from 'msw/http';
import { delay } from 'msw/utils/delay';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { userKeys } from '@/entities/user';
import { rememberLastReason } from '@/features/reject-with-reason';
import { API_CLIENT_LIMITS } from '@/shared/api';
import { uk } from '@/shared/i18n';
import type { ErrorToastContent } from '@/shared/ui/error-toast';
import { apiUrl, errorReply } from '@/test/api-handlers';
import { fakeTimeouts, layOutColumns, startDrag, waitOutDropClickGuard } from '@/test/board-drag';
import {
  boardRoute,
  type BoardRouteOptions,
  DESIGN_BOARD,
  DESIGN_BOARD_HEADINGS,
  moveRoute,
  type MoveRouteOptions,
  undoRoute,
} from '@/test/board-fixtures';
import { latch } from '@/test/latch';
import { push } from '@/test/navigation';
import { waitForQuery } from '@/test/query-status';
import { type BoardSettings, columnNamed, renderBoard } from '@/test/render-board';
import { server } from '@/test/server';

vi.mock('next/link', () => import('@/test/link'));

const MOVE = uk.board.move;

const DRAGGED_PAGE = '/applications/0b6f3c1e-5d2a-4c8e-9f10-000000000101';

const DRAGGED = 'Senior Frontend Engineer';

const EMPTY_SCREENING: BoardRouteOptions = {
  counts: { ...DESIGN_BOARD.counts, screening: 0 },
  cards: (DESIGN_BOARD.cards ?? []).filter((card) => card.currentStage !== 'screening'),
};

const AFTER_REJECT: BoardRouteOptions = {
  counts: { ...DESIGN_BOARD.counts, applied: 1, rejected: 33 },
  cards: (DESIGN_BOARD.cards ?? []).filter((card) => card.position !== DRAGGED),
};

type DragSetup = { board?: BoardRouteOptions; move?: MoveRouteOptions; settings?: BoardSettings };

type FailedMove = {
  name: string;
  reply: HttpResponseResolver;
  waitMs: number;
  toast: ErrorToastContent;
};

const FAILED_MOVES: readonly FailedMove[] = [
  {
    name: 'a 409 conflict',
    reply: () => errorReply({ status: 409, type: 'conflict' }),
    waitMs: 0,
    toast: MOVE.conflict,
  },
  {
    name: 'a 409 illegal_transition',
    reply: () => errorReply({ status: 409, type: 'illegal_transition' }),
    waitMs: 0,
    toast: MOVE.illegal({ from: 'відгук', to: 'скринінг' }),
  },
  {
    name: 'a refused connection',
    reply: () => HttpResponse.error(),
    waitMs: 0,
    toast: MOVE.failed,
  },
  {
    name: 'no answer within the request timeout',
    reply: () => delay('infinite'),
    waitMs: API_CLIENT_LIMITS.requestTimeoutMs,
    toast: MOVE.failed,
  },
];

async function boardReadyToDrag({ board = DESIGN_BOARD, move, settings }: DragSetup = {}) {
  const moves = moveRoute(move);
  server.use(moves.handler);
  const { user, sent } = renderBoard(board, settings);
  await screen.findByText(DRAGGED);
  await waitForQuery({ queryKey: userKeys.me(), status: 'success' });
  layOutColumns();
  return { user, moves: moves.sent, boardSent: sent };
}

function dragCardTo(column: string) {
  const drag = startDrag(screen.getByText(DRAGGED));
  drag.over(columnNamed(column));
  drag.drop();
}

function dropStates() {
  return DESIGN_BOARD_HEADINGS.map((name) => columnNamed(name).dataset.drop);
}

function stallBoardRefetch() {
  const asked: string[] = [];
  server.use(
    http.get(apiUrl('/applications/board'), ({ request }) => {
      asked.push(new URL(request.url).search);
      return delay('infinite');
    }),
  );
  return asked;
}

async function savedRejection(undo?: MoveRouteOptions) {
  fakeTimeouts();
  const undone = undoRoute(undo);
  const setup = await boardReadyToDrag();
  server.use(undone.handler, boardRoute(AFTER_REJECT).handler);
  dragCardTo('відмова 32');
  await waitOutDropClickGuard();
  await screen.findByRole('dialog', { name: uk.board.reject.title });
  await setup.user.keyboard('1');
  expect(await screen.findByText('записано в аналітику')).toBeDefined();
  return { ...setup, undone: undone.sent };
}

function draggedCard() {
  return within(columnNamed('відгук 2')).getByText(DRAGGED).closest('a');
}

async function overlayGone() {
  await waitFor(() => {
    expect(screen.getAllByText(DRAGGED)).toHaveLength(1);
  });
}

afterEach(() => {
  localStorage.clear();
  toast.dismiss();
  push.mockClear();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('KanbanBoard drag and drop', () => {
  it('a card dropped on скринінг shows there before the server answers, and the board is asked again once it does', async () => {
    const answer = latch();
    const { moves, boardSent } = await boardReadyToDrag({ move: { latch: answer } });

    dragCardTo('скринінг 1');

    await screen.findByRole('heading', { name: 'скринінг 2' });
    expect(within(columnNamed('скринінг 2')).getByText(DRAGGED)).toBeDefined();
    expect(within(columnNamed('відгук 1')).queryByText(DRAGGED)).toBeNull();
    expect(
      screen.getByText('«Senior Frontend Engineer» відпущено в колонці «скринінг».'),
    ).toBeDefined();
    await waitFor(() => {
      expect(moves).toEqual([{ fromStage: 'applied', toStage: 'screening' }]);
    });
    answer.release();
    await waitFor(() => {
      expect(boardSent).toEqual(['', '']);
    });
    expect(toast.getToasts()).toEqual([]);
  });

  it.each(FAILED_MOVES)(
    'after $name the card goes back to відгук and one toast says why',
    async (failure) => {
      fakeTimeouts();
      const answer = latch();
      const { moves } = await boardReadyToDrag({ move: { reply: failure.reply, latch: answer } });
      const boardAsked = stallBoardRefetch();

      dragCardTo('скринінг 1');
      await screen.findByRole('heading', { name: 'скринінг 2' });
      await waitFor(() => {
        expect(moves).toHaveLength(1);
      });
      answer.release();
      await act(() => vi.advanceTimersByTimeAsync(failure.waitMs));

      expect(await screen.findByText(failure.toast.title)).toBeDefined();
      expect(screen.getByText(failure.toast.description)).toBeDefined();
      expect(toast.getToasts()).toHaveLength(1);
      expect(within(columnNamed('відгук 2')).getByText(DRAGGED)).toBeDefined();
      expect(within(columnNamed('скринінг 1')).queryByText(DRAGGED)).toBeNull();
      await waitFor(() => {
        expect(boardAsked).toEqual(['']);
      });
    },
  );

  it('while a відгук card is held фінал and офер refuse it and dim, and a drop on фінал sends nothing', async () => {
    const { moves } = await boardReadyToDrag();

    const drag = startDrag(screen.getByText(DRAGGED));

    expect(dropStates()).toEqual([
      'idle',
      'allowed',
      'allowed',
      'refused',
      'refused',
      'allowed',
      'allowed',
      'allowed',
    ]);
    const final = columnNamed('фінал 0');
    expect([...final.classList]).toEqual(
      expect.arrayContaining([
        'data-[drop=refused]:opacity-50',
        'motion-safe:transition-opacity',
        'duration-(--duration-fast)',
      ]),
    );
    drag.over(final);
    drag.drop();
    await overlayGone();

    expect(within(columnNamed('відгук 2')).getByText(DRAGGED)).toBeDefined();
    expect(columnNamed('фінал 0').dataset.drop).toBe('idle');
    expect(moves).toEqual([]);
  });

  it('over скринінг the drop placeholder pops in, and Escape puts the card back with nothing sent', async () => {
    const { moves } = await boardReadyToDrag();

    const drag = startDrag(screen.getByText(DRAGGED));
    drag.over(columnNamed('скринінг 1'));

    const placeholder = within(columnNamed('скринінг 1')).getByText(MOVE.dropHere);
    expect(placeholder.classList).toContain('motion-safe:animate-pop-in');
    drag.cancel();
    await overlayGone();

    expect(screen.queryByText(MOVE.dropHere)).toBeNull();
    expect(within(columnNamed('відгук 2')).getByText(DRAGGED)).toBeDefined();
    expect(dropStates()).toEqual(DESIGN_BOARD_HEADINGS.map(() => 'idle'));
    expect(moves).toEqual([]);
  });

  it('over an empty скринінг the drop placeholder takes the place of its empty note', async () => {
    await boardReadyToDrag({ board: EMPTY_SCREENING });

    const drag = startDrag(screen.getByText(DRAGGED));
    drag.over(columnNamed('скринінг 0'));

    const screening = columnNamed('скринінг 0');
    expect(screening.dataset.drop).toBe('over');
    expect(within(screening).getByText(MOVE.dropHere)).toBeDefined();
    expect(within(screening).getByText(uk.board.columnEmpty[0]).closest('p')?.classList).toContain(
      'in-data-[drop=over]:hidden',
    );
    drag.cancel();
  });

  it('a card dropped on the folded ghosted strip moves there with one request and the strip stays folded', async () => {
    const { moves } = await boardReadyToDrag({ move: { latch: latch() } });

    const drag = startDrag(screen.getByText(DRAGGED));
    drag.over(columnNamed('ghosted 17'));
    expect(columnNamed('ghosted 17').dataset.drop).toBe('over');
    drag.drop();

    const strip = await screen.findByRole('button', { name: 'ghosted 18' });
    expect(strip.getAttribute('aria-expanded')).toBe('false');
    expect(columnNamed('відгук 1')).toBeDefined();
    await waitFor(() => {
      expect(moves).toEqual([{ fromStage: 'applied', toStage: 'ghosted' }]);
    });
  });

  it('a drop on відмова asks why before any request: Escape keeps the card and focuses it, a reason moves it at once with its code, the dialog says it was recorded, and «Готово» focuses the strip', async () => {
    fakeTimeouts();
    const answer = latch();
    const { user, moves } = await boardReadyToDrag({ move: { latch: answer } });

    dragCardTo('відмова 32');
    expect(await screen.findByRole('dialog', { name: uk.board.reject.title })).toBeDefined();
    expect(moves).toEqual([]);
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    const card = draggedCard();
    await waitFor(() => {
      expect(document.activeElement).toBe(card);
    });
    expect(moves).toEqual([]);

    dragCardTo('відмова 32');
    await waitOutDropClickGuard();
    await user.click(await screen.findByRole('button', { name: 'не вистачає скілів' }));

    const strip = await screen.findByRole('button', { name: 'відмова 33', hidden: true });
    await waitFor(() => {
      expect(moves).toEqual([
        { fromStage: 'applied', toStage: 'rejected', reasonCode: 'skills_gap' },
      ]);
    });
    server.use(boardRoute(AFTER_REJECT).handler);
    answer.release();
    expect(await screen.findByText('записано в аналітику')).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Готово' }));
    await waitFor(() => {
      expect(document.activeElement).toBe(strip);
    });
    expect(moves).toHaveLength(1);
  });

  it('ENTER in the reason question repeats the reason used last with one move, and a second ENTER sends nothing more', async () => {
    rememberLastReason('chose_other');
    const { user, moves } = await boardReadyToDrag();
    server.use(boardRoute(AFTER_REJECT).handler);

    dragCardTo('відмова 32');
    await screen.findByRole('dialog', { name: uk.board.reject.title });
    await user.keyboard('{Enter}{Enter}');

    expect(await screen.findByText('записано в аналітику')).toBeDefined();
    await user.keyboard('{Enter}');
    expect(
      screen.getByRole('dialog', { name: 'Trident Systems → відмова: обрали іншого' }),
    ).toBeDefined();
    expect(moves).toEqual([
      { fromStage: 'applied', toStage: 'rejected', reasonCode: 'chose_other' },
    ]);
  });

  it('«Скасувати перенос» puts the card back in відгук with one undo-last and focuses it', async () => {
    const { user, undone } = await savedRejection();
    server.use(boardRoute(DESIGN_BOARD).handler);

    await user.click(screen.getByRole('button', { name: 'Скасувати перенос' }));

    expect(await screen.findByRole('button', { name: 'відмова 32' })).toBeDefined();
    const card = draggedCard();
    await waitFor(() => {
      expect(document.activeElement).toBe(card);
    });
    await waitFor(() => {
      expect(undone).toEqual([{ id: '0b6f3c1e-5d2a-4c8e-9f10-000000000101', body: '' }]);
    });
    expect(toast.getToasts()).toEqual([]);
  });

  it('a 409 on undo keeps the card in відмова and one toast says the undo time is over', async () => {
    const { user } = await savedRejection({
      reply: () => errorReply({ status: 409, type: 'conflict' }),
    });

    await user.click(screen.getByRole('button', { name: 'Скасувати перенос' }));

    expect(await screen.findByText('Час на скасування минув')).toBeDefined();
    expect(screen.getByText('Карточка лишилася у «відмова».')).toBeDefined();
    expect(await screen.findByRole('button', { name: 'відмова 33' })).toBeDefined();
    expect(within(columnNamed('відгук 1')).queryByText(DRAGGED)).toBeNull();
    expect(toast.getToasts()).toHaveLength(1);
  });

  it('with the reason question turned off a drop on відмова sends the move at once, with no reason', async () => {
    const { moves } = await boardReadyToDrag({
      move: { latch: latch() },
      settings: { askRejectionReason: false },
    });

    dragCardTo('відмова 32');

    expect(await screen.findByRole('button', { name: 'відмова 33' })).toBeDefined();
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => {
      expect(moves).toEqual([{ fromStage: 'applied', toStage: 'rejected' }]);
    });
  });

  it('Tab walks the cards column by column, then the outcome strips', async () => {
    const { user } = await boardReadyToDrag();
    const stops = [
      ...[
        DRAGGED,
        'Product Designer',
        'Go Backend Engineer',
        'Platform Engineer',
        'Frontend Engineer',
      ].map((position) => screen.getByText(position).closest('a')),
      ...['відмова 32', 'ghosted 17', 'відкликав 0'].map((name) =>
        screen.getByRole('button', { name }),
      ),
    ];

    const focused: (Element | null)[] = [];
    while (focused.length < stops.length) {
      await user.tab();
      focused.push(document.activeElement);
    }

    expect(focused).toEqual(stops);
  });

  it('a click on a card opens its vacancy page and keeps the board scroll', async () => {
    const { user } = await boardReadyToDrag();
    const card = draggedCard();

    await user.click(screen.getByText(DRAGGED));

    expect(card?.getAttribute('href')).toBe(DRAGGED_PAGE);
    expect(card?.dataset.scroll).toBe('false');
    expect(card?.getAttribute('role')).toBeNull();
    expect(push.mock.calls).toEqual([[DRAGGED_PAGE]]);
  });

  it('a card dropped on скринінг does not open its vacancy page', async () => {
    await boardReadyToDrag({ move: { latch: latch() } });

    dragCardTo('скринінг 1');
    fireEvent.click(screen.getAllByText(DRAGGED)[0] ?? document.body);

    await screen.findByRole('heading', { name: 'скринінг 2' });
    expect(push).not.toHaveBeenCalled();
  });
});
