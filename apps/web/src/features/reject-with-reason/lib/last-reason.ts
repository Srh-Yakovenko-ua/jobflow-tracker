import { type RejectionReasonCode, rejectionReasonCodeSchema } from '@jobflow/shared';

import { logger } from '@/shared/lib/logger';

export const LAST_REASON_KEY = 'jobflow.last-rejection-reason';

export function readLastReason(): RejectionReasonCode | undefined {
  try {
    const stored = rejectionReasonCodeSchema.safeParse(localStorage.getItem(LAST_REASON_KEY));
    return stored.success ? stored.data : undefined;
  } catch (error) {
    logger.warn({ err: error }, 'last rejection reason unreadable');
    return undefined;
  }
}

export function rememberLastReason(code: RejectionReasonCode): void {
  try {
    localStorage.setItem(LAST_REASON_KEY, code);
  } catch (error) {
    logger.warn({ err: error }, 'last rejection reason not stored');
  }
}
