import { useEffect, useSyncExternalStore } from 'react';

import { createListeners } from '@/shared/lib/listeners';

export type SkeletonMotion = 'shimmer' | 'static';

export const SKELETON_LIMITS = { staticFrom: 20 } as const;

const registry = { mounted: 0 };

const { subscribe, notify } = createListeners();

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
