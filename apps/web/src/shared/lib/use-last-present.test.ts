import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useLastPresent } from './use-last-present';

function renderLastPresent(value: string | null) {
  return renderHook((props) => useLastPresent(props.value), { initialProps: { value } });
}

describe('useLastPresent', () => {
  it('keeps the last value after it goes away, so closing content can animate out', () => {
    const { result, rerender } = renderLastPresent('Acme');

    rerender({ value: null });

    expect(result.current).toBe('Acme');
  });

  it('follows a new value at once', () => {
    const { result, rerender } = renderLastPresent('Acme');

    rerender({ value: 'Globex' });

    expect(result.current).toBe('Globex');
  });

  it('a value that comes back after a close replaces the one kept', () => {
    const { result, rerender } = renderLastPresent('Acme');

    rerender({ value: null });
    rerender({ value: 'Globex' });
    rerender({ value: null });

    expect(result.current).toBe('Globex');
  });

  it('shows nothing before any value arrives', () => {
    const { result } = renderLastPresent(null);

    expect(result.current).toBeNull();
  });
});
