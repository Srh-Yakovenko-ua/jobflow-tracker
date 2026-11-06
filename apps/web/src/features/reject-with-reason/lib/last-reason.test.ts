import { afterEach, describe, expect, it, vi } from 'vitest';

import { refuseStorage } from '@/test/refusing-storage';

import { LAST_REASON_KEY, readLastReason, rememberLastReason } from './last-reason';

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
    refuseStorage();

    expect(() => {
      rememberLastReason('skills_gap');
    }).not.toThrow();
    expect(readLastReason()).toBeUndefined();
  });
});
