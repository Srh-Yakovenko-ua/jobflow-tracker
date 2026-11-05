'use client';

import { CHART_THEME } from '@jobflow/shared/chart-theme';
import { MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';

import { usePrefersReducedMotion } from '@/shared/lib/reduced-motion';

export type MotionProviderProps = Readonly<{ children: ReactNode }>;

const MOTION_TRANSITION = {
  moving: { duration: CHART_THEME.motion.base / 1000, ease: CHART_THEME.motion.easing },
  still: { duration: 0 },
} as const;

export function MotionProvider({ children }: MotionProviderProps) {
  const reduced = usePrefersReducedMotion();
  return (
    <MotionConfig
      reducedMotion="user"
      transition={reduced ? MOTION_TRANSITION.still : MOTION_TRANSITION.moving}
    >
      {children}
    </MotionConfig>
  );
}
