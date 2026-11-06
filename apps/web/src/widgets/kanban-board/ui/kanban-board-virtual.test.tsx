import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { layOutColumns, startDrag } from '@/test/board-drag';
import { type BoardRouteOptions, cardIn, cardsIn } from '@/test/board-fixtures';
import { fakeTimeouts } from '@/test/fake-timeouts';
import { latch } from '@/test/latch';
import { boardReadyToDrag, columnNamed } from '@/test/render-board';

import { DROP_GLIDE } from '../model/drop-glide';

vi.mock('next/link', () => import('@/test/link'));
vi.mock('next/navigation', () => import('@/test/navigation'));

const PICKED = 'Senior Frontend Engineer';

const HINT = /^ще \d+ карт/;

function appliedBoard(count: number): BoardRouteOptions {
  return { counts: { applied: count }, cards: cardsIn({ stage: 'applied', count, from: 1000 }) };
}

const INTO_LONG_SCREENING: BoardRouteOptions = {
  counts: { applied: 1, screening: 40 },
  cards: [
    cardIn({ serial: 101, stage: 'applied', position: PICKED }),
    ...cardsIn({ stage: 'screening', count: 40, from: 1000 }),
  ],
};

async function longBoardReady(board: BoardRouteOptions) {
  layOutColumns();
  return boardReadyToDrag({ board, move: { latch: latch() } });
}

function cardLinkIn(column: HTMLElement, position: string): HTMLAnchorElement | null {
  return within(column).queryByText(position)?.closest('a') ?? null;
}

function scrollToEnd(column: HTMLElement) {
  const scroller = column.querySelector<HTMLElement>('[data-column-scroll]');
  if (scroller === null) {
    throw new Error('the column does not scroll');
  }
  scroller.scrollTop = 100_000;
  fireEvent.scroll(scroller);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('KanbanBoard long columns', () => {
  it('a відгук of 500 cards heads all 500, mounts only the cards near the view, says how many are below, and once scrolled to its end shows the last card with no hint', async () => {
    await longBoardReady(appliedBoard(500));
    const applied = columnNamed('відгук 500');

    expect(within(applied).getAllByRole('link').length).toBeLessThan(40);
    expect(within(applied).getByText('ще 494 картки нижче')).toBeDefined();
    scrollToEnd(applied);

    expect(await within(applied).findByText('Vacancy 1499')).toBeDefined();
    expect(within(applied).queryByText(HINT)).toBeNull();
  });

  it.each([
    { count: 30, mounted: 30, scrolls: false, hint: null },
    { count: 31, mounted: 12, scrolls: true, hint: 'ще 25 карток нижче' },
  ])(
    'a відгук of $count cards mounts $mounted of them, scrolls inside: $scrolls, hint: $hint',
    async ({ count, mounted, scrolls, hint }) => {
      await longBoardReady(appliedBoard(count));
      const applied = columnNamed(`відгук ${String(count)}`);

      expect(within(applied).getAllByRole('link')).toHaveLength(mounted);
      expect(applied.querySelector('[data-column-scroll]') !== null).toBe(scrolls);
      expect(within(applied).queryByText(HINT)?.textContent ?? null).toBe(hint);
    },
  );

  it('the card dragged out of a 40-card відгук stays mounted while that column scrolls to its end, and its drop on скринінг sends one move', async () => {
    const { moves } = await longBoardReady(appliedBoard(40));
    const applied = columnNamed('відгук 40');

    const drag = startDrag(within(applied).getByText('Vacancy 1000'));
    scrollToEnd(applied);
    await within(applied).findByText('Vacancy 1039');

    expect(cardLinkIn(applied, 'Vacancy 1000')).toBeInstanceOf(HTMLAnchorElement);
    drag.over(columnNamed('скринінг 0'));
    drag.drop();
    await waitFor(() => {
      expect(moves).toEqual([{ fromStage: 'applied', toStage: 'screening' }]);
    });
  });

  it('after a keyboard drop into a 40-card скринінг scrolled to its end, the moved card has focus once it lands', async () => {
    fakeTimeouts();
    const { user } = await longBoardReady(INTO_LONG_SCREENING);
    scrollToEnd(columnNamed('скринінг 40'));
    const picked = cardLinkIn(columnNamed('відгук 1'), PICKED);

    picked?.focus();
    await user.keyboard(' ');
    await user.keyboard('{ArrowRight} ');
    await screen.findByRole('heading', { name: 'скринінг 41' });
    picked?.blur();
    await act(() => vi.advanceTimersByTimeAsync(DROP_GLIDE.settleMs));

    const moved = cardLinkIn(columnNamed('скринінг 41'), PICKED);
    expect(moved).toBeInstanceOf(HTMLAnchorElement);
    await waitFor(() => {
      expect(document.activeElement).toBe(moved);
    });
  });
});
