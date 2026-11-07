import { useEffect, useEffectEvent, useRef } from 'react';

import type { FeatureFlags } from '@/shared/config';
import { isTypingTarget } from '@/shared/lib/typing-target';

import {
  type Shortcut,
  type ShortcutKey,
  shortcutsOf,
  type ShortcutTarget,
} from './palette-commands';

export type GlobalShortcutActions = Readonly<{
  onPalette: () => void;
  onShortcut: (target: ShortcutTarget) => void;
}>;

export type GlobalShortcutsInput = Readonly<{
  flags: FeatureFlags;
  singleKeys: boolean;
  actions: GlobalShortcutActions;
}>;

type Chord = Readonly<{ code: string; at: number }>;

type KeyPress = Readonly<{ shortcuts: readonly Shortcut[]; event: KeyboardEvent }>;

const CHORD_MS = 1000;

const LAYERS = '[role="dialog"], [role="alertdialog"], [role="menu"]';

function isPaletteKey(event: KeyboardEvent): boolean {
  const namesK = event.key.toLowerCase() === 'k' || event.code === 'KeyK';
  return namesK && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey;
}

function isInsideLayer(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(LAYERS) !== null;
}

function isPlainKey(event: KeyboardEvent): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return false;
  return !isTypingTarget(event.target) && !isInsideLayer(event.target);
}

function matchesKey(event: KeyboardEvent, key: ShortcutKey): boolean {
  const shiftFits = key.shift === undefined || event.shiftKey === key.shift;
  return (event.code === key.code && shiftFits) || event.key.toLowerCase() === key.key;
}

function chordEndedBy({ shortcuts, event }: KeyPress, chord: Chord | null): Shortcut | undefined {
  if (chord === null || Date.now() - chord.at > CHORD_MS) return undefined;
  return shortcuts.find(
    ({ keys: [first, second] }) =>
      first?.code === chord.code && second !== undefined && matchesKey(event, second),
  );
}

function singleKeyOf({ shortcuts, event }: KeyPress): Shortcut | undefined {
  return shortcuts.find(
    ({ keys: [only, second] }) =>
      only !== undefined && second === undefined && matchesKey(event, only),
  );
}

function chordStartOf({ shortcuts, event }: KeyPress): ShortcutKey | undefined {
  return shortcuts
    .map(({ keys }) => keys)
    .find(
      ([first, second]) => first !== undefined && second !== undefined && matchesKey(event, first),
    )
    ?.at(0);
}

export function useGlobalShortcuts({ flags, singleKeys, actions }: GlobalShortcutsInput): void {
  const chordRef = useRef<Chord | null>(null);
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (isPaletteKey(event)) {
      event.preventDefault();
      chordRef.current = null;
      actions.onPalette();
      return;
    }
    if (!singleKeys || !isPlainKey(event)) return;
    const press = { shortcuts: shortcutsOf(flags), event };
    const fired = chordEndedBy(press, chordRef.current) ?? singleKeyOf(press);
    const start = fired === undefined ? chordStartOf(press) : undefined;
    chordRef.current = start === undefined ? null : { code: start.code, at: Date.now() };
    if (fired === undefined) return;
    event.preventDefault();
    actions.onShortcut(fired.target);
  });
  useEffect(() => {
    const listener = (event: Event) => {
      if (event instanceof KeyboardEvent) onKeyDown(event);
    };
    document.addEventListener('keydown', listener);
    return () => {
      document.removeEventListener('keydown', listener);
    };
  }, []);
}
