import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useQueryNow } from './use-query-now';

const MOUNTED_AT = Date.parse('2026-11-20T09:00:00.000Z');

const FETCHED_LATER = Date.parse('2026-11-21T10:30:00.000Z');

function nowOf(initial: number) {
  vi.useFakeTimers({ now: MOUNTED_AT });
  return renderHook(({ dataUpdatedAt }) => useQueryNow({ dataUpdatedAt }), {
    initialProps: { dataUpdatedAt: initial },
  });
}

describe('useQueryNow', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('a query not answered yet is labelled from the moment the screen opened', () => {
    expect(nowOf(0).result.current.toISOString()).toBe('2026-11-20T09:00:00.000Z');
  });

  it('a later answer moves now to the time that answer arrived', () => {
    const { result, rerender } = nowOf(0);

    rerender({ dataUpdatedAt: FETCHED_LATER });

    expect(result.current.toISOString()).toBe('2026-11-21T10:30:00.000Z');
  });
});
