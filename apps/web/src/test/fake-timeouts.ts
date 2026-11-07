import { act } from '@testing-library/react';
import { vi } from 'vitest';

import { QUERY_DEFAULTS } from '@/app/query-client';

export function fakeTimeouts() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
}

export function fakeTimeoutsAndClock() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'], shouldAdvanceTime: true });
}

export function refocusTabOnceStale() {
  vi.setSystemTime(Date.now() + QUERY_DEFAULTS.staleTimeMs);
  act(() => {
    window.dispatchEvent(new Event('visibilitychange'));
  });
}
