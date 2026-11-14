import { logger } from '@/shared/lib/logger';

const OFFER_DISMISSED_KEY = 'jobflow.push-offer-dismissed';

export function readOfferDismissed(): boolean {
  try {
    return localStorage.getItem(OFFER_DISMISSED_KEY) !== null;
  } catch (error) {
    logger.warn({ err: error }, 'push offer dismissal unreadable');
    return false;
  }
}

export function rememberOfferDismissed(): void {
  try {
    localStorage.setItem(OFFER_DISMISSED_KEY, 'true');
  } catch (error) {
    logger.warn({ err: error }, 'push offer dismissal not stored');
  }
}
