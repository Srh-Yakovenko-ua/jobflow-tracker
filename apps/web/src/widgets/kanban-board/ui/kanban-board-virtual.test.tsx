import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { uk } from '@/shared/i18n';
import { layOutColumns, settleLanding, startDrag } from '@/test/board-drag';
import { type BoardRouteOptions, cardIn, cardsIn } from '@/test/board-fixtures';
import { fakeTimeouts } from '@/test/fake-timeouts';
import { latch } from '@/test/latch';
import { type MotionPreference, stubMotionPreference } from '@/test/motion-preference';
import { stubOverlayGlide } from '@/test/overlay-glide';
import { boardReadyToDrag, columnNamed } from '@/test/render-board';

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

function scrollerOf(column: HTMLElement): HTMLElement {
  const scroller = column.querySelector<HTMLElement>('[data-column-scroll]');
  if (scroller === null) {
    throw new Error('the column does not scroll');
  }
  return scroller;
}

function scrollColumnTo(column: HTMLElement, top: number) {
  const scroller = scrollerOf(column);
  scroller.scrollTop = top;
  fireEvent.scroll(scroller);
}

function scrollToEnd(column: HTMLElement) {
  scrollColumnTo(column, 100_000);
}

function rowTopOf(link: HTMLAnchorElement | null): number {
  const row = link?.closest<HTMLElement>('[data-index]');
  return Number(/translateY\((-?[\d.]+)px\)/.exec(row?.style.transform ?? '')?.[1] ?? Number.NaN);
}

function columnView(column: HTMLElement) {
  return {
    mounted: within(column).getAllByRole('link').length,
    hint: within(column).queryByText(HINT)?.textContent ?? null,
    scrollTop: scrollerOf(column).scrollTop,
  };
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
    await settleLanding();

    const moved = cardLinkIn(columnNamed('скринінг 41'), PICKED);
    expect(moved).toBeInstanceOf(HTMLAnchorElement);
    await waitFor(() => {
      expect(document.activeElement).toBe(moved);
    });
  });

  it('Tab walks a 40-card відгук from its first card to its 30th without ever leaving the column', async () => {
    const { user } = await longBoardReady(appliedBoard(40));
    const applied = columnNamed('відгук 40');
    act(() => {
      cardLinkIn(applied, 'Vacancy 1000')?.focus();
    });

    const outside: string[] = [];
    for (let press = 1; press < 30; press += 1) {
      await user.tab();
      if (!applied.contains(document.activeElement)) outside.push(`press ${String(press)}`);
    }

    expect(outside).toEqual([]);
    expect(document.activeElement).toBe(cardLinkIn(applied, 'Vacancy 1029'));
  });

  it.each<MotionPreference>(['no-preference', 'reduce'])(
    'with prefers-reduced-motion: %s, a pointer drop into a 40-card скринінг scrolled to its end scrolls it back to the moved card, which lands first and in view',
    async (motion) => {
      fakeTimeouts();
      stubMotionPreference(motion);
      stubOverlayGlide();
      await longBoardReady(INTO_LONG_SCREENING);
      scrollToEnd(columnNamed('скринінг 40'));

      const drag = startDrag(within(columnNamed('відгук 1')).getByText(PICKED));
      drag.over(columnNamed('скринінг 40'));
      drag.drop();
      await screen.findByRole('heading', { name: 'скринінг 41' });
      await settleLanding();
      const screening = columnNamed('скринінг 41');

      const { scrollTop } = scrollerOf(screening);
      expect(scrollTop).toBe(0);
      const top = rowTopOf(cardLinkIn(screening, PICKED));
      expect(top).toBeGreaterThanOrEqual(scrollTop);
      expect(top).toBeLessThanOrEqual(scrollTop + 600);
    },
  );

  it('Escape in the reason question after a drop from the end of a scrolled 40-card відгук focuses the dropped card, though the column scrolled back to its top', async () => {
    fakeTimeouts();
    const { user } = await longBoardReady(appliedBoard(40));
    const applied = columnNamed('відгук 40');
    scrollToEnd(applied);

    const drag = startDrag(await within(applied).findByText('Vacancy 1039'));
    drag.over(columnNamed('відмова 0'));
    drag.drop();
    const dialog = await screen.findByRole('dialog', { name: uk.board.reject.title });
    await settleLanding();
    scrollColumnTo(applied, 0);
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(document.activeElement).toBe(cardLinkIn(applied, 'Vacancy 1039'));
    });
  });

  it.each([
    {
      scrolledTo: 0,
      full: { mounted: 12, hint: 'ще 34 картки нижче', scrollTop: 0 },
      compact: { mounted: 13, hint: 'ще 33 картки нижче', scrollTop: 0 },
    },
    {
      scrolledTo: 1200,
      full: { mounted: 17, hint: 'ще 25 карток нижче', scrollTop: 1200 },
      compact: { mounted: 19, hint: 'ще 22 картки нижче', scrollTop: 1200 },
    },
  ])(
    '«Щільні» on a 40-card відгук scrolled to $scrolledTo measures its cards again and keeps the column scrolled',
    async ({ scrolledTo, full, compact }) => {
      const { user } = await longBoardReady(appliedBoard(40));
      const applied = columnNamed('відгук 40');
      if (scrolledTo > 0) scrollColumnTo(applied, scrolledTo);

      const before = columnView(applied);
      await user.click(screen.getByRole('radio', { name: uk.board.density.compact }));

      expect({ before, after: columnView(applied) }).toEqual({ before: full, after: compact });
    },
  );

  it('«Щільні» on a 40-card відгук lays its cards out again at the compact card height', async () => {
    const { user } = await longBoardReady(appliedBoard(40));
    const applied = columnNamed('відгук 40');

    const before = rowTopOf(cardLinkIn(applied, 'Vacancy 1002'));
    await user.click(screen.getByRole('radio', { name: uk.board.density.compact }));

    expect({ before, after: rowTopOf(cardLinkIn(applied, 'Vacancy 1002')) }).toEqual({
      before: 240,
      after: 180,
    });
  });

  it('«Щільні» on a 500-card відгук scrolled to its end keeps the last card mounted, says no card is below and leaves no card with its stack', async () => {
    const { user } = await longBoardReady(appliedBoard(500));
    const applied = columnNamed('відгук 500');
    const view = () => ({
      ...columnView(applied),
      last: cardLinkIn(applied, 'Vacancy 1499') !== null,
      stacks: within(applied).queryAllByText('React').length,
    });
    scrollToEnd(applied);
    await within(applied).findByText('Vacancy 1499');

    const before = view();
    await user.click(screen.getByRole('radio', { name: uk.board.density.compact }));

    expect({ before, after: view() }).toEqual({
      before: { mounted: 11, hint: null, scrollTop: 100_000, last: true, stacks: 11 },
      after: { mounted: 12, hint: null, scrollTop: 100_000, last: true, stacks: 0 },
    });
  });
});
