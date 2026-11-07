import { fireEvent, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FEATURE_FLAGS, type FeatureFlags } from '@/shared/config';
import { EVERY_FLAG_ON } from '@/test/feature-flags';

import { useGlobalShortcuts } from './use-global-shortcuts';

type Press = KeyboardEventInit & Readonly<{ key: string; code: string }>;

const LATIN = {
  n: { key: 'n', code: 'KeyN' },
  g: { key: 'g', code: 'KeyG' },
  b: { key: 'b', code: 'KeyB' },
  a: { key: 'a', code: 'KeyA' },
  r: { key: 'r', code: 'KeyR' },
  question: { key: '?', code: 'Slash', shiftKey: true },
} as const satisfies Record<string, Press>;

const UKRAINIAN = {
  n: { key: 'т', code: 'KeyN' },
  g: { key: 'п', code: 'KeyG' },
  b: { key: 'и', code: 'KeyB' },
  a: { key: 'ф', code: 'KeyA' },
  r: { key: 'к', code: 'KeyR' },
  question: { key: ',', code: 'Slash', shiftKey: true },
} as const satisfies Record<string, Press>;

type Listening = Readonly<{ flags?: FeatureFlags; singleKeys?: boolean }>;

function listen({ flags = EVERY_FLAG_ON, singleKeys = true }: Listening = {}) {
  const actions = { onPalette: vi.fn(), onShortcut: vi.fn() };
  renderHook(() => {
    useGlobalShortcuts({ flags, singleKeys, actions });
  });
  return actions;
}

function press(presses: readonly Press[], target: Element = document.body) {
  return presses.map((init) => fireEvent.keyDown(target, init));
}

function mounted<T extends Element>(element: T): T {
  document.body.append(element);
  return element;
}

function typingTargetIn(html: string): Element {
  document.body.innerHTML = html;
  const target = document.querySelector('[data-target]');
  if (target === null) throw new Error(`no [data-target] in ${html}`);
  return target;
}

function pressGThenB(times: readonly [number, number]) {
  const actions = listen();
  const clock = vi.spyOn(Date, 'now').mockReturnValue(times[0]);
  press([LATIN.g]);
  clock.mockReturnValue(times[1]);
  press([LATIN.b]);
  return actions;
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe.each([
  { layout: 'Latin', keys: LATIN },
  { layout: 'Ukrainian', keys: UKRAINIAN },
])('global shortcuts on the $layout layout', ({ keys }) => {
  it.each([
    { name: 'N', presses: [keys.n], target: { kind: 'navigate', href: '/add' } },
    { name: 'G B', presses: [keys.g, keys.b], target: { kind: 'navigate', href: '/board' } },
    { name: 'G A', presses: [keys.g, keys.a], target: { kind: 'navigate', href: '/analytics' } },
    { name: 'G R', presses: [keys.g, keys.r], target: { kind: 'navigate', href: '/reminders' } },
    { name: '?', presses: [keys.question], target: { kind: 'shortcuts' } },
  ])('$name opens its target', ({ presses, target }) => {
    const actions = listen();

    press(presses);

    expect(actions.onShortcut.mock.calls).toEqual([[target]]);
  });
});

describe('global shortcuts', () => {
  it('N, G A and G R do nothing while their pages are behind the flags, G B still works', () => {
    const actions = listen({ flags: FEATURE_FLAGS });

    press([LATIN.n, LATIN.g, LATIN.a, LATIN.g, LATIN.r, LATIN.g, LATIN.b]);

    expect(actions.onShortcut.mock.calls).toEqual([[{ kind: 'navigate', href: '/board' }]]);
  });

  it.each([
    { name: 'an input', html: '<input data-target />' },
    { name: 'a textarea', html: '<textarea data-target></textarea>' },
    { name: 'a contenteditable', html: '<p contenteditable="true" data-target></p>' },
    { name: 'an open dialog', html: '<div role="dialog"><button data-target>OK</button></div>' },
  ])('N, G B and ? typed in $name stay there', ({ html }) => {
    const actions = listen();

    press([LATIN.n, LATIN.g, LATIN.b, LATIN.question], typingTargetIn(html));

    expect(actions.onShortcut).not.toHaveBeenCalled();
  });

  it('Ctrl+K and Cmd+K open the palette, also from inside a field, and type nothing', () => {
    const actions = listen();
    const field = mounted(document.createElement('input'));

    const handled = [
      ...press([{ key: 'k', code: 'KeyK', ctrlKey: true }]),
      ...press([{ key: 'л', code: 'KeyK', metaKey: true }], field),
    ];

    expect(actions.onPalette).toHaveBeenCalledTimes(2);
    expect(handled).toEqual([false, false]);
  });

  it('with single key shortcuts off, N, every G chord and ? do nothing and Ctrl+K still opens the palette', () => {
    const actions = listen({ singleKeys: false });

    press([LATIN.n, LATIN.g, LATIN.b, LATIN.g, LATIN.a, LATIN.g, LATIN.r, LATIN.question]);
    press([{ key: 'k', code: 'KeyK', ctrlKey: true }]);

    expect(actions.onShortcut).not.toHaveBeenCalled();
    expect(actions.onPalette).toHaveBeenCalledTimes(1);
  });

  it('K with Shift, K with Alt and a plain K leave the palette closed', () => {
    const actions = listen();

    press([
      { key: 'K', code: 'KeyK', ctrlKey: true, shiftKey: true },
      { key: 'k', code: 'KeyK', ctrlKey: true, altKey: true },
      { key: 'k', code: 'KeyK' },
    ]);

    expect(actions.onPalette).not.toHaveBeenCalled();
  });

  it('a modifier with N and a plain slash are not shortcuts here', () => {
    const actions = listen();

    press([
      { ...LATIN.n, ctrlKey: true },
      { ...LATIN.n, metaKey: true },
      { ...LATIN.n, altKey: true },
      { key: '/', code: 'Slash' },
    ]);

    expect(actions.onShortcut).not.toHaveBeenCalled();
  });

  it('B more than a second after G does nothing', () => {
    const actions = pressGThenB([10_000, 11_001]);

    expect(actions.onShortcut).not.toHaveBeenCalled();
  });

  it('B within a second of G opens the board', () => {
    const actions = pressGThenB([10_000, 11_000]);

    expect(actions.onShortcut).toHaveBeenCalledWith({ kind: 'navigate', href: '/board' });
  });

  it('a keydown with no key, as autofill sends, throws nothing and runs nothing', () => {
    const actions = listen();
    const thrown = vi.fn();
    window.addEventListener('error', thrown);

    document.dispatchEvent(new Event('keydown', { bubbles: true }));
    window.removeEventListener('error', thrown);

    expect(thrown).not.toHaveBeenCalled();
    expect(actions.onPalette).not.toHaveBeenCalled();
    expect(actions.onShortcut).not.toHaveBeenCalled();
  });
});
