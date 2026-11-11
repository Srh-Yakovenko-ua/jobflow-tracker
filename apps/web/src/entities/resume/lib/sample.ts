import { THRESHOLDS } from '@jobflow/shared';

export function missingForPercent(applicationsCount: number): number {
  return Math.max(THRESHOLDS.MIN_N_PERCENT - applicationsCount, 0);
}
