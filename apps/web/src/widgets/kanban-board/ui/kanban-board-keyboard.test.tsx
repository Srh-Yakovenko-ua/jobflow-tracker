import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { uk } from '@/shared/i18n';
import { errorReply } from '@/test/api-handlers';
import { startDrag } from '@/test/board-drag';
import { fakeTimeouts } from '@/test/fake-timeouts';
import { latch } from '@/test/latch';
import { push } from '@/test/navigation';
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

  it('after a keyboard drop on скринінг the moved card has focus in its new column', async () => {
    fakeTimeouts();
    const { user } = await boardReadyToDrag({ move: { latch: latch() } });

    await pickUp(user, APPLIED_CARD);
    await user.keyboard('{ArrowRight} ');
    await screen.findByRole('heading', { name: 'скринінг 2' });
    await settleLanding();

    const moved = within(columnNamed('скринінг 2')).getByText(APPLIED_CARD).closest('a');
    await waitFor(() => {
      expect(document.activeElement).toBe(moved);
    });
  });

  it.each(ROLLBACK_TIMINGS)(
    'a keyboard move to скринінг answered 409 $when puts focus back on the card in відгук',
    async ({ order }) => {
      fakeTimeouts();
      const answer = latch();
      const { user } = await boardReadyToDrag({
        move: { reply: () => errorReply({ status: 409, type: 'conflict' }), latch: answer },
      });
      const steps = {
        land: settleLanding,
        refuse: async () => {
          answer.release();
          await screen.findByRole('heading', { name: 'відгук 2' });
        },
      };

      await pickUp(user, APPLIED_CARD);
      await user.keyboard('{ArrowRight} ');
      await screen.findByRole('heading', { name: 'скринінг 2' });
      for (const step of order) await steps[step]();

      await waitFor(() => {
        expect(document.activeElement).toBe(
          within(columnNamed('відгук 2')).getByText(APPLIED_CARD).closest('a'),
        );
      });
    },
  );

  it('after a keyboard drop on the folded ghosted strip the strip has focus', async () => {
    fakeTimeouts();
    const { user, moves } = await boardReadyToDrag({ move: { latch: latch() } });

    await pickUp(user, APPLIED_CARD);
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight} ');
    const strip = await screen.findByRole('button', { name: 'ghosted 18' });
    await settleLanding();

    await waitFor(() => {
      expect(document.activeElement).toBe(strip);
    });
    expect(moves).toEqual([{ fromStage: 'applied', toStage: 'ghosted' }]);
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
