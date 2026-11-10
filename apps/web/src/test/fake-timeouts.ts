import { act } from '@testing-library/react';
import { vi } from 'vitest';

import { QUERY_DEFAULTS } from '@/app/query-client';
import { API_CLIENT_LIMITS } from '@/shared/api';

const FIRST_RETRY_PAUSE_MS = 1_000;

export function fakeTimeouts() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
}

export function fakeTimeoutsAndIntervals() {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    shouldAdvanceTime: true,
  });
}

export function advanceBy(ms: number) {
  return act(() => vi.advanceTimersByTimeAsync(ms));
}

export function advancePastQueryRetries() {
  return advanceBy(
    (QUERY_DEFAULTS.queryRetries + 1) * API_CLIENT_LIMITS.requestTimeoutMs +
      QUERY_DEFAULTS.queryRetries * FIRST_RETRY_PAUSE_MS,
  );
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
