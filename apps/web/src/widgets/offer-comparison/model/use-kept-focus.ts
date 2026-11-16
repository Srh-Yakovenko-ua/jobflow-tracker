'use client';

import { type FocusEvent, type RefObject, useEffect, useLayoutEffect, useRef } from 'react';

export type KeptFocus = Readonly<{
  containerRef: RefObject<HTMLDivElement | null>;
  onFocus: (event: FocusEvent<HTMLElement>) => void;
  onBlur: (event: FocusEvent<HTMLElement>) => void;
}>;

function isOutside(container: HTMLElement | null, target: EventTarget | null): boolean {
  return container !== null && target instanceof Node && !container.contains(target);
}

export function useKeptFocus(order: string): KeptFocus {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const forgetOnOutsidePress = (event: PointerEvent) => {
      if (isOutside(containerRef.current, event.target)) lastFocusedRef.current = null;
    };
    document.addEventListener('pointerdown', forgetOnOutsidePress, true);
    return () => {
      document.removeEventListener('pointerdown', forgetOnOutsidePress, true);
    };
  }, []);
  useLayoutEffect(() => {
    const control = lastFocusedRef.current;
    if (control === null || !control.isConnected || document.activeElement !== document.body) {
      return;
    }
    control.focus({ preventScroll: true });
  }, [order]);
  return {
    containerRef,
    onFocus: (event) => {
      lastFocusedRef.current = event.target;
    },
    onBlur: (event) => {
      if (isOutside(containerRef.current, event.relatedTarget)) lastFocusedRef.current = null;
    },
  };
}
