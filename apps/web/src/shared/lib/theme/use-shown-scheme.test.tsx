import type { Theme } from '@jobflow/shared';
import { act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { stubMediaQuery } from '@/test/media-query';
import { renderHookInTheme } from '@/test/theme';

import { useTheme } from './theme-provider';
import { useShownScheme } from './use-shown-scheme';

const DARK_SCHEME = '(prefers-color-scheme: dark)';

function renderShownScheme(initialTheme: Theme) {
  return renderHookInTheme(() => ({ scheme: useShownScheme(), ...useTheme() }), initialTheme);
}

describe('useShownScheme', () => {
  it('shows the picked theme whatever the OS prefers', () => {
    stubMediaQuery({ query: DARK_SCHEME, matches: true });
    const { result } = renderShownScheme('light');
    expect(result.current.scheme).toBe('light');

    act(() => {
      result.current.setTheme('dark');
    });
    expect(result.current.scheme).toBe('dark');
  });

  it('follows the OS in system mode and flips when the OS preference changes', () => {
    const { result } = renderShownScheme('system');
    expect(result.current.scheme).toBe('light');

    act(() => {
      stubMediaQuery({ query: DARK_SCHEME, matches: true });
    });
    expect(result.current.scheme).toBe('dark');
  });
});
