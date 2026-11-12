import { afterEach, beforeEach, vi } from 'vitest';

export function pinClockInEachTest(now: Date): void {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });
}
