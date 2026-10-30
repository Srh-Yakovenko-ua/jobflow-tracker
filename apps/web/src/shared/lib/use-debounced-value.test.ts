import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useDebouncedValue } from './use-debounced-value';

const DELAY_MS = 250;

function debounced(initial: string) {
  return renderHook(({ value }) => useDebouncedValue(value, DELAY_MS), {
    initialProps: { value: initial },
  });
}

describe('useDebouncedValue', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('hands the new text on only once it has been still for the whole delay', () => {
    vi.useFakeTimers();
    const { result, rerender } = debounced('tr');

    rerender({ value: 'tri' });
    act(() => {
      vi.advanceTimersByTime(DELAY_MS - 1);
    });
    expect(result.current).toBe('tr');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('tri');
  });

  it('a keystroke inside the delay restarts it, so only the last text is handed on', () => {
    vi.useFakeTimers();
    const { result, rerender } = debounced('tr');

    rerender({ value: 'tri' });
    act(() => {
      vi.advanceTimersByTime(DELAY_MS - 50);
    });
    rerender({ value: 'trid' });
    act(() => {
      vi.advanceTimersByTime(DELAY_MS - 50);
    });
    expect(result.current).toBe('tr');

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current).toBe('trid');
  });
});
