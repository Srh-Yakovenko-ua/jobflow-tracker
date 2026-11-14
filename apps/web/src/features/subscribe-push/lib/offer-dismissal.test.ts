import { afterEach, describe, expect, it, vi } from 'vitest';

import { refuseStorage } from '@/test/refusing-storage';

import { readOfferDismissed, rememberOfferDismissed } from './offer-dismissal';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('push offer dismissal', () => {
  it('an offer never dismissed in this browser reads as open', () => {
    expect(readOfferDismissed()).toBe(false);
  });

  it('«Не зараз» is kept under its own key', () => {
    rememberOfferDismissed();

    expect(readOfferDismissed()).toBe(true);
    expect(localStorage.getItem('jobflow.push-offer-dismissed')).not.toBeNull();
  });

  it('a storage that refuses reads as open and remembering does not throw', () => {
    const warn = refuseStorage();

    expect(() => {
      rememberOfferDismissed();
    }).not.toThrow();
    expect(readOfferDismissed()).toBe(false);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
