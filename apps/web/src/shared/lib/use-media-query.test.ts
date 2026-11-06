import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { mediaListenersOf, stubMediaQuery } from '@/test/media-query';

import { useMediaQuery } from './use-media-query';

const WIDE = '(min-width: 48rem)';

describe('useMediaQuery', () => {
  it('reads true for the query that matches and false for one that does not', () => {
    stubMediaQuery({ query: WIDE, matches: true });

    expect(renderHook(() => useMediaQuery(WIDE)).result.current).toBe(true);
    expect(renderHook(() => useMediaQuery('(min-width: 80rem)')).result.current).toBe(false);
  });

  it('follows the change event when the viewport crosses the breakpoint', () => {
    const { result } = renderHook(() => useMediaQuery(WIDE));
    expect(result.current).toBe(false);

    act(() => {
      stubMediaQuery({ query: WIDE, matches: true });
    });

    expect(result.current).toBe(true);
  });

  it('stops listening to the query once the component unmounts', () => {
    const { unmount } = renderHook(() => useMediaQuery(WIDE));
    expect(mediaListenersOf(WIDE)).toBe(1);

    unmount();

    expect(mediaListenersOf(WIDE)).toBe(0);
  });
});
