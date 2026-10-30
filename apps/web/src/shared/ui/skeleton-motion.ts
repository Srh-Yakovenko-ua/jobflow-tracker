import { useEffect, useSyncExternalStore } from 'react';

export type SkeletonMotion = 'shimmer' | 'static';

export const SKELETON_LIMITS = { staticFrom: 20 } as const;

const registry = { mounted: 0, listeners: new Set<() => void>() };

function notify(): void {
  registry.listeners.forEach((listener) => {
    listener();
  });
}

function subscribe(listener: () => void): () => void {
  registry.listeners.add(listener);
  return () => {
    registry.listeners.delete(listener);
  };
}

function register(): () => void {
  registry.mounted += 1;
  notify();
  return () => {
    registry.mounted -= 1;
    notify();
  };
}

function currentMotion(): SkeletonMotion {
  return registry.mounted >= SKELETON_LIMITS.staticFrom ? 'static' : 'shimmer';
}

function serverMotion(): SkeletonMotion {
  return 'shimmer';
}

export function useSkeletonMotion(): SkeletonMotion {
  useEffect(register, []);
  return useSyncExternalStore(subscribe, currentMotion, serverMotion);
}
