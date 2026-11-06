import { matchesMediaQuery, useMediaQuery } from './use-media-query';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export function prefersReducedMotion(): boolean {
  return matchesMediaQuery(REDUCED_MOTION_QUERY);
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery(REDUCED_MOTION_QUERY);
}
