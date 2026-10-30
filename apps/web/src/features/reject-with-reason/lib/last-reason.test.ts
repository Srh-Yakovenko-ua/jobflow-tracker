import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from '@/shared/lib/logger';

import { LAST_REASON_KEY, readLastReason, rememberLastReason } from './last-reason';

function storageRefuses() {
  const refuse = () => {
    throw new DOMException('The operation is insecure.', 'SecurityError');
  };
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(refuse);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(refuse);
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('last rejection reason', () => {
  it('reads back the reason remembered last, unspecified included', () => {
    rememberLastReason('chose_other');
    rememberLastReason('unspecified');

    expect(readLastReason()).toBe('unspecified');
  });

  it('nothing stored reads as none', () => {
    expect(readLastReason()).toBeUndefined();
  });

  it('a stored code that is not a reason reads as none', () => {
    localStorage.setItem(LAST_REASON_KEY, 'hired');

    expect(readLastReason()).toBeUndefined();
  });

  it('a storage that refuses reads as none and remembering does not throw', () => {
    storageRefuses();

    expect(() => {
      rememberLastReason('skills_gap');
    }).not.toThrow();
    expect(readLastReason()).toBeUndefined();
  });
});
