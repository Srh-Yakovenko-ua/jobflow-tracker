import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { useSingleKeyShortcuts } from '@/entities/user';
import { FEATURE_FLAGS } from '@/shared/config';

import { useGlobalShortcuts } from './use-global-shortcuts';

export type ShellSurface = 'palette' | 'shortcuts';

function focusedElement(): HTMLElement | null {
  const focused = document.activeElement;
  return focused instanceof HTMLElement && focused !== document.body ? focused : null;
}

function twinOf(opener: HTMLElement | null): HTMLElement | undefined {
  const href = opener?.getAttribute('href');
  if (href === undefined || href === null) return undefined;
  return Array.from(document.querySelectorAll<HTMLElement>('a[href]')).find(
    (link) => link.getAttribute('href') === href,
  );
}

export function focusBack(opener: HTMLElement | null): void {
  const target = opener?.isConnected ? opener : twinOf(opener);
  (target ?? document.getElementById('main'))?.focus();
}

export function useShellSurfaces() {
  const router = useRouter();
  const [surface, setSurface] = useState<ShellSurface | null>(null);
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  const afterCloseRef = useRef<(() => void) | null>(null);
  const open = (next: ShellSurface) => {
    if (surface === null) setOpener(focusedElement());
    setSurface(next);
  };
  const closeThen = (run?: () => void) => {
    afterCloseRef.current = run ?? null;
    setSurface(null);
  };
  const onCloseAutoFocus = (event: Event) => {
    event.preventDefault();
    focusBack(opener);
    const run = afterCloseRef.current;
    afterCloseRef.current = null;
    run?.();
  };
  const reopenPalette = () => {
    open('palette');
  };
  const onPalette = () => {
    if (surface === null) open('palette');
    else closeThen(surface === 'shortcuts' ? reopenPalette : undefined);
  };
  useGlobalShortcuts({
    flags: FEATURE_FLAGS,
    singleKeys: useSingleKeyShortcuts(),
    actions: {
      onPalette,
      onShortcut: (target) => {
        if (target.kind === 'navigate') router.push(target.href);
        else open('shortcuts');
      },
    },
  });
  return { surface, opener, open, closeThen, onCloseAutoFocus };
}

export type ShellSurfaces = ReturnType<typeof useShellSurfaces>;
