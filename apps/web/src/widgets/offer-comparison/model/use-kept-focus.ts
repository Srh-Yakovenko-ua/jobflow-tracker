'use client';

import { type FocusEvent, useLayoutEffect, useRef } from 'react';

export type KeptFocus = Readonly<{ onFocus: (event: FocusEvent<HTMLElement>) => void }>;

export function useKeptFocus(order: string): KeptFocus {
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const control = lastFocusedRef.current;
    if (control === null || !control.isConnected || document.activeElement !== document.body) {
      return;
    }
    control.focus({ preventScroll: true });
  }, [order]);
  return {
    onFocus: (event) => {
      lastFocusedRef.current = event.target;
    },
  };
}
