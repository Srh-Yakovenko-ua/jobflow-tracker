import type { Stage } from '@jobflow/shared';
import { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { API_CLIENT_LIMITS } from '@/shared/api';
import { uk } from '@/shared/i18n';
import { errorReply, OUTAGES } from '@/test/api-handlers';
import type { BoardCardRouteOptions } from '@/test/application-fixtures';
import { startDrag } from '@/test/board-drag';
import { type BoardRouteOptions, type ColumnCounts, DESIGN_BOARD } from '@/test/board-fixtures';
import { fakeTimeouts, fakeTimeoutsAndClock, refocusTabOnceStale } from '@/test/fake-timeouts';
import { type Latch, latch } from '@/test/latch';
import { stubMotionPreference } from '@/test/motion-preference';
import { push } from '@/test/navigation';
import { stubOverlayGlide } from '@/test/overlay-glide';
import { boardReadyToDrag, columnNamed } from '@/test/render-board';

import { DROP_GLIDE } from '../model/drop-glide';

vi.mock('next/link', () => import('@/test/link'));
vi.mock('next/navigation', () => import('@/test/navigation'));

const A11Y = uk.board.move.a11y;

const HINT = uk.board.move.keyboardHint;

const APPLIED_CARD = 'Senior Frontend Engineer';

const SCREENING_CARD = 'Go Backend Engineer';

const SAVED_STEP_CLOSERS = [
  { closer: 'ESC', close: (user: UserEvent) => user.keyboard('{Escape}') },
  {
    closer: '«Готово»',
    close: (user: UserEvent) => {
      screen.getByRole('button', { name: uk.board.reject.saved.done }).focus();
      return user.keyboard('{Enter}');
    },
  },
];

const ROLLBACK_TIMINGS = [
  { when: 'after the card lands', order: ['land', 'refuse'] },
  { when: 'while the card still glides', order: ['refuse', 'land'] },
] as const;

const MOTION_MODES = [
  { motion: 'no-preference', glides: 1 },
  { motion: 'reduce', glides: 0 },
] as const;

type AnotherTab = { movedTo: Stage | null };

type AnotherTabMove = { to: Stage; counts?: ColumnCounts };

function cardLink(position: string): HTMLAnchorElement {
  const link = screen.getByText(position).closest('a');
  if (link === null) {
    throw new Error(`no card link reads "${position}"`);
  }
  return link;
}

function liveAnnouncement(): string | null {
  return document.querySelector('[role="status"][aria-live="assertive"]')?.textContent ?? null;
}

async function expectAnnounced(text: string) {
  await waitFor(() => {
    expect(liveAnnouncement()).toBe(text);
  });
}

async function pickUp(user: UserEvent, position: string) {
  const card = cardLink(position);
  card.focus();
  await user.keyboard(' ');
  return card;
}

function keyboardHint(): HTMLElement | null {
  return screen.queryByText(HINT.picked, { exact: false });
}

async function settleLanding() {
  await act(() => vi.advanceTimersByTimeAsync(DROP_GLIDE.settleMs));
}

async function expectFocusBackOnceLanded(card: HTMLAnchorElement) {
  expect(card.closest('.invisible')).toBeInstanceOf(HTMLElement);
  card.blur();
  await settleLanding();
  await waitFor(() => {
    expect(document.activeElement).toBe(card);
  });
}

async function expectGlides(glide: ReturnType<typeof stubOverlayGlide>, times: number) {
  await waitFor(() => {
    expect(glide).toHaveBeenCalledTimes(times);
  });
}

function holdBoardPatch(patch: Latch) {
  vi.spyOn(QueryClient.prototype, 'cancelQueries').mockImplementationOnce(async function held(
    this: QueryClient,
    ...filters: Parameters<QueryClient['cancelQueries']>
  ) {
    await patch.reached;
    return this.cancelQueries(...filters);
  });
}

async function keyboardDropRefused(board: BoardCardRouteOptions = DESIGN_BOARD) {
  fakeTimeoutsAndClock();
  const answer = latch();
  const { user } = await boardReadyToDrag({
    board,
    move: { reply: () => errorReply({ status: 409, type: 'conflict' }), latch: answer },
  });
  await pickUp(user, APPLIED_CARD);
  await user.keyboard('{ArrowRight} ');
  await screen.findByRole('heading', { name: 'скринінг 2' });
  return { answer, user };
}

function sharedWithAnotherTab(tab: AnotherTab, counts: ColumnCounts = {}): BoardRouteOptions {
  return {
    ...DESIGN_BOARD,
    counts: { ...DESIGN_BOARD.counts, ...counts },
    liveCard: (card) =>
      tab.movedTo !== null && card.position === APPLIED_CARD
        ? { ...card, currentStage: tab.movedTo }
        : card,
  };
}

async function refusedAfterAnotherTabMoved({ to, counts }: AnotherTabMove) {
  stubOverlayGlide();
  const tab: AnotherTab = { movedTo: null };
  const { answer, user } = await keyboardDropRefused(sharedWithAnotherTab(tab, counts));
  tab.movedTo = to;
  await settleLanding();
  answer.release();
  return { tab, user };
}

function appliedCardIn(column: string): HTMLAnchorElement | null {
  return within(columnNamed(column)).getByText(APPLIED_CARD).closest('a');
}

async function expectFocusOn(target: () => Element | null) {
  await waitFor(() => {
    expect(document.activeElement).toBe(target());
  });
}

afterEach(() => {
  localStorage.clear();
  push.mockClear();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('KanbanBoard keyboard drag and drop', () => {
  it.each(SAVED_STEP_CLOSERS)(
    'a скринінг card reaches відмова with a reason by keyboard alone, and $closer on the saved step focuses the відмова strip',
    async ({ close }) => {
      const { user, moves } = await boardReadyToDrag();
      const strip = screen.getByRole('button', { name: 'відмова 32' });

      await pickUp(user, SCREENING_CARD);
      await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight} ');
      await screen.findByRole('dialog', { name: uk.board.reject.title });
      expect(moves).toEqual([]);
      await user.keyboard('1');

      expect(await screen.findByText(uk.board.reject.saved.eyebrow)).toBeDefined();
      expect(moves).toEqual([
        { fromStage: 'screening', toStage: 'rejected', reasonCode: 'skills_gap' },
      ]);
      await close(user);
      await waitFor(() => {
        expect(document.activeElement).toBe(strip);
      });
    },
  );

  it('from відгук the third ARROW RIGHT skips the refused фінал and офер to land on відмова, and SPACE there asks why before any request', async () => {
    const { user, moves } = await boardReadyToDrag();

    await pickUp(user, APPLIED_CARD);
    expect(columnNamed('фінал 0').dataset.drop).toBe('refused');
    expect(columnNamed('офер 1').dataset.drop).toBe('refused');
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(columnNamed("техінтерв'ю 1").dataset.drop).toBe('over');
    await user.keyboard('{ArrowRight}');
    expect(columnNamed('відмова 32').dataset.drop).toBe('over');
    await user.keyboard(' ');

    expect(await screen.findByRole('dialog', { name: uk.board.reject.title })).toBeDefined();
    expect(moves).toEqual([]);
  });

  it('a screen reader hears the pick up, the column under the card and the drop, and the card points to the key instructions', async () => {
    const { user } = await boardReadyToDrag({ move: { latch: latch() } });
    const card = cardLink(APPLIED_CARD);
    const instructions = document.getElementById(card.getAttribute('aria-describedby') ?? '');
    expect(instructions?.textContent).toBe(A11Y.instructions);

    await pickUp(user, APPLIED_CARD);
    await expectAnnounced(A11Y.pickedUp(APPLIED_CARD));
    await user.keyboard('{ArrowRight}');
    await expectAnnounced(A11Y.over({ position: APPLIED_CARD, stage: 'скринінг' }));
    await user.keyboard(' ');

    await expectAnnounced(A11Y.dropped({ position: APPLIED_CARD, stage: 'скринінг' }));
  });

  it.each(['{Escape}', '{Tab}'])(
    '%s puts a picked card back in відгук with nothing sent, the reader hears it and the card has focus again once it lands',
    async (key) => {
      fakeTimeouts();
      const { user, moves } = await boardReadyToDrag();

      const card = await pickUp(user, APPLIED_CARD);
      await user.keyboard('{ArrowRight}');
      await user.keyboard(key);

      await expectAnnounced(A11Y.cancelled(APPLIED_CARD));
      expect(within(columnNamed('відгук 2')).getByText(APPLIED_CARD)).toBeDefined();
      await expectFocusBackOnceLanded(card);
      expect(moves).toEqual([]);
    },
  );

  it('SPACE before any arrow leaves the card in відгук with nothing sent and gives it focus again once it lands', async () => {
    fakeTimeouts();
    const { user, moves } = await boardReadyToDrag();

    const card = await pickUp(user, APPLIED_CARD);
    await user.keyboard(' ');

    expect(within(columnNamed('відгук 2')).getByText(APPLIED_CARD)).toBeDefined();
    await expectFocusBackOnceLanded(card);
    expect(moves).toEqual([]);
  });

  it('ARROW UP, ARROW DOWN and ARROW LEFT from відгук move nothing and never scroll the page', async () => {
    const { user } = await boardReadyToDrag();

    const card = await pickUp(user, APPLIED_CARD);
    const scrolled = ['ArrowUp', 'ArrowDown', 'ArrowLeft'].map((code) =>
      fireEvent.keyDown(card, { key: code, code }),
    );

    expect(scrolled).toEqual([false, false, false]);
    await expectAnnounced(A11Y.pickedUp(APPLIED_CARD));
    expect(document.querySelector('[data-drop="over"]')).toBeNull();
  });

  it('ENTER on a focused card opens its vacancy page and picks nothing up', async () => {
    const { user } = await boardReadyToDrag();

    cardLink(APPLIED_CARD).focus();
    await user.keyboard('{Enter}');

    expect(push.mock.calls).toEqual([['/applications/0b6f3c1e-5d2a-4c8e-9f10-000000000101']]);
    expect(liveAnnouncement()).toBe('');
  });

  it('a keyboard pick shows the key hint under the card in відгук, hidden from the screen reader, until ESC', async () => {
    const { user } = await boardReadyToDrag();

    await pickUp(user, APPLIED_CARD);
    const hint = within(columnNamed('відгук 2')).getByText(HINT.picked, { exact: false });
    expect(hint.textContent).toBe(
      'Картку взято з клавіатури. ←/→ етап, SPACE відпустити, ESC скасувати.',
    );
    expect(hint.closest('[aria-hidden="true"]')).toBeInstanceOf(HTMLElement);
    await user.keyboard('{Escape}');

    await expectAnnounced(A11Y.cancelled(APPLIED_CARD));
    expect(keyboardHint()).toBeNull();
  });

  it('a mouse drag never shows the key hint', async () => {
    await boardReadyToDrag();

    const drag = startDrag(cardLink(APPLIED_CARD));
    await expectAnnounced(A11Y.pickedUp(APPLIED_CARD));

    expect(keyboardHint()).toBeNull();
    drag.cancel();
  });
});

describe.each(MOTION_MODES)(
  'KanbanBoard keyboard focus with prefers-reduced-motion: $motion',
  ({ motion, glides }) => {
    beforeEach(() => {
      stubMotionPreference(motion);
    });

    it('after a keyboard drop on скринінг the moved card has focus in its new column', async () => {
      fakeTimeouts();
      const glide = stubOverlayGlide();
      const patch = latch();
      const { user } = await boardReadyToDrag({ move: { latch: latch() } });
      holdBoardPatch(patch);

      await pickUp(user, APPLIED_CARD);
      await user.keyboard('{ArrowRight} ');
      await settleLanding();
      patch.release();
      await screen.findByRole('heading', { name: 'скринінг 2' });

      const moved = within(columnNamed('скринінг 2')).getByText(APPLIED_CARD).closest('a');
      await waitFor(() => {
        expect(document.activeElement).toBe(moved);
      });
      await expectGlides(glide, glides);
    });

    it.each(ROLLBACK_TIMINGS)(
      'a keyboard move to скринінг answered 409 $when puts focus back on the card in відгук',
      async ({ order }) => {
        const glide = stubOverlayGlide();
        const { answer } = await keyboardDropRefused();
        const steps = {
          land: settleLanding,
          refuse: async () => {
            answer.release();
            await screen.findByRole('heading', { name: 'відгук 2' });
          },
        };
        for (const step of order) await steps[step]();

        await waitFor(() => {
          expect(document.activeElement).toBe(
            within(columnNamed('відгук 2')).getByText(APPLIED_CARD).closest('a'),
          );
        });
        await expectGlides(glide, glides);
      },
    );

    it("a keyboard move to скринінг answered 409 after another tab moved the card to техінтерв'ю puts focus on the card in техінтерв'ю once the board is fetched again", async () => {
      const glide = stubOverlayGlide();
      const anotherTab = { moved: false };
      const { answer } = await keyboardDropRefused({
        ...DESIGN_BOARD,
        liveCard: (card) =>
          anotherTab.moved && card.position === APPLIED_CARD
            ? { ...card, currentStage: 'tech_interview' }
            : card,
      });
      anotherTab.moved = true;
      await settleLanding();
      answer.release();

      await waitFor(() => {
        expect(document.activeElement).toBe(
          within(columnNamed("техінтерв'ю 1")).getByText(APPLIED_CARD).closest('a'),
        );
      });
      await expectGlides(glide, glides);
    });

    it("after a 409 has put focus on the card in скринінг, a later refetch that shows the card in техінтерв'ю leaves focus in the search field", async () => {
      const { tab, user } = await refusedAfterAnotherTabMoved({ to: 'screening' });
      await expectFocusOn(() => appliedCardIn('скринінг 1'));

      const search = screen.getByRole('textbox', { name: uk.board.filters.search.label });
      await user.click(search);
      tab.movedTo = 'tech_interview';
      refocusTabOnceStale();
      await waitFor(() => {
        expect(appliedCardIn("техінтерв'ю 1")).toBeInstanceOf(HTMLAnchorElement);
      });
      await settleLanding();

      expect(document.activeElement).toBe(search);
    });

    it('a keyboard move to скринінг answered 409 after another tab moved the card to відкликав puts focus on the відкликав strip', async () => {
      await refusedAfterAnotherTabMoved({ to: 'withdrawn', counts: { withdrawn: 1 } });

      await expectFocusOn(() => screen.getByRole('button', { name: 'відкликав 1' }));
    });

    it.each(OUTAGES)(
      'a keyboard move to скринінг answered 409 puts focus back on the card in відгук when the read of the card $name',
      async ({ reply }) => {
        stubOverlayGlide();
        const { answer } = await keyboardDropRefused({ ...DESIGN_BOARD, cardRead: reply });
        await settleLanding();
        answer.release();
        await act(() => vi.advanceTimersByTimeAsync(API_CLIENT_LIMITS.requestTimeoutMs));

        await expectFocusOn(() => appliedCardIn('відгук 2'));
      },
    );

    it('after a keyboard drop on the folded ghosted strip the strip has focus', async () => {
      fakeTimeouts();
      const glide = stubOverlayGlide();
      const { user, moves } = await boardReadyToDrag({ move: { latch: latch() } });

      await pickUp(user, APPLIED_CARD);
      await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight} ');
      const strip = await screen.findByRole('button', { name: 'ghosted 18' });
      await settleLanding();

      await waitFor(() => {
        expect(document.activeElement).toBe(strip);
      });
      expect(moves).toEqual([{ fromStage: 'applied', toStage: 'ghosted' }]);
      await expectGlides(glide, glides);
    });
  },
);
