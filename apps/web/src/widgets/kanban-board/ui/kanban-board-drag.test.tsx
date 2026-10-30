import { act, screen, waitFor, within } from '@testing-library/react';
import type { HttpResponseResolver } from 'msw';
import { http, HttpResponse } from 'msw/http';
import { delay } from 'msw/utils/delay';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { userKeys } from '@/entities/user';
import { API_CLIENT_LIMITS } from '@/shared/api';
import { uk } from '@/shared/i18n';
import type { ErrorToastContent } from '@/shared/ui/error-toast';
import { apiUrl, errorReply } from '@/test/api-handlers';
import { layOutColumns, startDrag } from '@/test/board-drag';
import {
  type BoardRouteOptions,
  DESIGN_BOARD,
  DESIGN_BOARD_HEADINGS,
  moveRoute,
  type MoveRouteOptions,
} from '@/test/board-fixtures';
import { latch } from '@/test/latch';
import { waitForQuery } from '@/test/query-status';
import { type BoardSettings, columnNamed, renderBoard } from '@/test/render-board';
import { server } from '@/test/server';

const MOVE = uk.board.move;

const DRAGGED = 'Senior Frontend Engineer';

const EMPTY_SCREENING: BoardRouteOptions = {
  counts: { ...DESIGN_BOARD.counts, screening: 0 },
  cards: (DESIGN_BOARD.cards ?? []).filter((card) => card.currentStage !== 'screening'),
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

async function overlayGone() {
  await waitFor(() => {
    expect(screen.getAllByText(DRAGGED)).toHaveLength(1);
  });
}

afterEach(() => {
  toast.dismiss();
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
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
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

  it('a drop on відмова asks why before any request: Escape keeps the card and focuses it, a reason sends it with its code and focuses the strip', async () => {
    const { user, moves } = await boardReadyToDrag({ move: { latch: latch() } });

    dragCardTo('відмова 32');
    expect(await screen.findByRole('dialog', { name: uk.board.reject.title })).toBeDefined();
    expect(moves).toEqual([]);
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    const card = within(columnNamed('відгук 2')).getByText(DRAGGED).closest('[role="button"]');
    await waitFor(() => {
      expect(document.activeElement).toBe(card);
    });
    expect(moves).toEqual([]);

    dragCardTo('відмова 32');
    await user.click(await screen.findByRole('button', { name: 'не вистачає скілів' }));

    const strip = await screen.findByRole('button', { name: 'відмова 33' });
    await waitFor(() => {
      expect(document.activeElement).toBe(strip);
    });
    await waitFor(() => {
      expect(moves).toEqual([
        { fromStage: 'applied', toStage: 'rejected', reasonCode: 'skills_gap' },
      ]);
    });
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
      ].map((position) => screen.getByText(position).closest('[role="button"]')),
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
});
