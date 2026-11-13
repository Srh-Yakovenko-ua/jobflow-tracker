import { CHART_THEME } from '@jobflow/shared/chart-theme';

import { usePrefersReducedMotion } from './reduced-motion';

const MS = 1000;

const DATA_TRANSITION = {
  grow: { duration: CHART_THEME.animation.duration / MS, ease: CHART_THEME.motion.easing },
  still: { duration: 0 },
} as const;

export function useDataTransition() {
  return usePrefersReducedMotion() ? DATA_TRANSITION.still : DATA_TRANSITION.grow;
}
