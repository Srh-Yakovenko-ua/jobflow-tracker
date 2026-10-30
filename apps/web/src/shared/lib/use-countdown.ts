import { useSyncExternalStore } from 'react';

const SECOND_MS = 1000;

function secondsUntil(deadline: number | undefined): number {
  if (deadline === undefined) return 0;
  return Math.max(0, Math.ceil((deadline - Date.now()) / SECOND_MS));
}

function noTimeLeft(): number {
  return 0;
}

function stayIdle(): void {}

function ticksUntil(deadline: number | undefined) {
  return (onTick: () => void) => {
    if (secondsUntil(deadline) === 0) return stayIdle;
    const timer = setInterval(() => {
      onTick();
      if (secondsUntil(deadline) === 0) clearInterval(timer);
    }, SECOND_MS);
    return () => {
      clearInterval(timer);
    };
  };
}

export function useCountdown(deadline: number | undefined): number {
  return useSyncExternalStore(ticksUntil(deadline), () => secondsUntil(deadline), noTimeLeft);
}
