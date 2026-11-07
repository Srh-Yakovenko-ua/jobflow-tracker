import type { ClientRect } from '@dnd-kit/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fakeAnimation } from '@/test/fake-animation';
import { stubMotionPreference } from '@/test/motion-preference';

import { createDropGlide, type DropLanding, type GlideStart } from './drop-glide';

type Box = Readonly<{ left: number; top: number }>;

type FakeBoardOptions = Readonly<{ animates?: boolean; running?: boolean }>;

type Animate = (
  keyframes: Keyframe[],
  timing: KeyframeAnimationOptions,
) => ReturnType<typeof fakeAnimation>;

const FRAME_MS = 16;

const CARD_ID = '0b6f3c1e-5d2a-4c8e-9f10-000000000101';

const BOX = {
  overlay: { left: 340, top: 110 },
  source: { left: 300, top: 100 },
  moved: { left: 600, top: 60 },
  nowhere: { left: 0, top: 0 },
} as const;

const GLIDE_TIMING = { duration: 200, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)', fill: 'forwards' };

const AT_DROP = { transform: 'translate3d(40px, 10px, 0) scaleX(1) scaleY(1)' };

const AT_SOURCE = { transform: 'translate3d(0px, 0px, 0) scaleX(1) scaleY(1)' };

const AT_MOVED = { transform: 'translate3d(300px, -40px, 0) scaleX(1) scaleY(1)' };

function rectOf({ left, top }: Box): ClientRect {
  return { left, top, width: 250, height: 76, right: left + 250, bottom: top + 76 };
}

function fakeBoard({ animates = true, running = false }: FakeBoardOptions = {}) {
  const source = document.createElement('a');
  const moved = document.createElement('a');
  const rolledBack = document.createElement('a');
  const overlay = document.createElement('div');
  const animation = fakeAnimation({ running });
  const animate = vi.fn<Animate>(() => animation);
  if (animates) Object.defineProperty(overlay, 'animate', { value: animate });
  const card: { current: HTMLElement | null } = { current: source };
  const boxes = new Map<Element, Box>([
    [source, BOX.source],
    [moved, BOX.moved],
  ]);
  const start: GlideStart = {
    active: { id: CARD_ID, node: source },
    dragOverlay: { node: overlay, rect: rectOf(BOX.overlay) },
    draggableNodes: new Map([[CARD_ID, { node: card }]]),
    measuringConfiguration: {
      draggable: { measure: (node) => rectOf(boxes.get(node) ?? BOX.nowhere) },
    },
    transform: { x: 40, y: 10, scaleX: 1, scaleY: 1 },
  };
  return { start, animate, animation, card, moved, rolledBack, onLanded: vi.fn() };
}

function dropWith(landing: DropLanding, board: ReturnType<typeof fakeBoard>) {
  return createDropGlide({ landing, onLanded: board.onLanded })(board.start);
}

afterEach(() => {
  vi.useRealTimers();
});

describe('createDropGlide', () => {
  it('a sent move waits until the card shows up in its new column, then glides there at the base duration', async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame'] });
    const board = fakeBoard();

    const landed = dropWith('to-card', board);
    await vi.advanceTimersByTimeAsync(FRAME_MS * 3);
    expect(board.animate).not.toHaveBeenCalled();
    board.card.current = board.moved;
    await vi.advanceTimersByTimeAsync(FRAME_MS);
    await landed;

    expect(board.animate.mock.calls).toEqual([[[AT_DROP, AT_MOVED], GLIDE_TIMING]]);
    expect(board.onLanded).toHaveBeenCalledTimes(1);
  });

  it('when the card leaves its new column during the glide, as a rollback does, the glide ends at once', async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame'] });
    const board = fakeBoard({ running: true });

    const landed = dropWith('to-card', board);
    board.card.current = board.moved;
    await vi.advanceTimersByTimeAsync(FRAME_MS * 3);
    expect(board.animate).toHaveBeenCalledTimes(1);
    expect(board.animation.finish).not.toHaveBeenCalled();
    board.card.current = board.rolledBack;
    await vi.advanceTimersByTimeAsync(FRAME_MS);

    expect(board.animation.finish).toHaveBeenCalledTimes(1);
    await landed;
    expect(board.onLanded).toHaveBeenCalledTimes(1);
  });

  it('a card fading out on an outcome strip keeps fading when it leaves the board', async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame'] });
    const board = fakeBoard({ running: true });

    void dropWith('in-place', board);
    await vi.advanceTimersByTimeAsync(0);
    board.card.current = null;
    await vi.advanceTimersByTimeAsync(FRAME_MS * 3);

    expect(board.animate).toHaveBeenCalledTimes(1);
    expect(board.animation.finish).not.toHaveBeenCalled();
    expect(board.onLanded).not.toHaveBeenCalled();
  });

  it('a drop that sends no move glides straight back to the source, before any frame', async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame'] });
    const board = fakeBoard();

    const landed = dropWith('to-source', board);
    await vi.advanceTimersByTimeAsync(0);

    expect(board.animate.mock.calls).toEqual([[[AT_DROP, AT_SOURCE], GLIDE_TIMING]]);
    await landed;
    expect(board.onLanded).toHaveBeenCalledTimes(1);
  });

  it('a card sent to an outcome stage fades out where it was let go', async () => {
    const board = fakeBoard();

    await dropWith('in-place', board);

    expect(board.animate.mock.calls).toEqual([[[{ opacity: 1 }, { opacity: 0 }], GLIDE_TIMING]]);
    expect(board.onLanded).toHaveBeenCalledTimes(1);
  });

  it('when the card never shows up in its new column, the glide stops waiting after 30 frames and aims at the node it has', async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame'] });
    const board = fakeBoard();

    const landed = dropWith('to-card', board);
    await vi.advanceTimersByTimeAsync(FRAME_MS * 29);
    expect(board.animate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(FRAME_MS);
    await landed;

    expect(board.animate.mock.calls).toEqual([[[AT_DROP, AT_SOURCE], GLIDE_TIMING]]);
    expect(board.onLanded).toHaveBeenCalledTimes(1);
  });

  it('with reduced motion on the overlay lands at once with no animation', async () => {
    stubMotionPreference('reduce');
    const board = fakeBoard();

    await dropWith('to-card', board);

    expect(board.animate).not.toHaveBeenCalled();
    expect(board.onLanded).toHaveBeenCalledTimes(1);
  });

  it('without the Web Animations API the overlay lands at once', async () => {
    const board = fakeBoard({ animates: false });

    await dropWith('to-source', board);

    expect(board.animate).not.toHaveBeenCalled();
    expect(board.onLanded).toHaveBeenCalledTimes(1);
  });
});
