import { act } from '@testing-library/react';
import { vi } from 'vitest';

export function advanceBy(ms: number) {
  return act(() => vi.advanceTimersByTimeAsync(ms));
}
