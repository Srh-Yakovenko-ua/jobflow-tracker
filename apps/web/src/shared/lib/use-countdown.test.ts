import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCountdown } from './use-countdown';

const SECOND_MS = 1000;

function countdownTo(deadline: number | undefined) {
  return renderHook(({ until }) => useCountdown(until), { initialProps: { until: deadline } });
}

function tickSecond() {
  act(() => {
    vi.advanceTimersByTime(SECOND_MS);
  });
}

describe('useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts whole seconds down to 0 and then leaves no interval running', () => {
    const { result } = countdownTo(Date.now() + 3 * SECOND_MS);
    const seen = [result.current];

    for (let tick = 0; tick < 3; tick += 1) {
      tickSecond();
      seen.push(result.current);
    }

    expect(seen).toEqual([3, 2, 1, 0]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a new deadline restarts the count from its own seconds', () => {
    const { result, rerender } = countdownTo(Date.now() + 2 * SECOND_MS);
    tickSecond();
    tickSecond();
    expect(result.current).toBe(0);

    rerender({ until: Date.now() + 5 * SECOND_MS });
    tickSecond();

    expect(result.current).toBe(4);
  });

  it('no deadline gives 0 and starts no interval', () => {
    const { result } = countdownTo(undefined);

    expect(result.current).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
