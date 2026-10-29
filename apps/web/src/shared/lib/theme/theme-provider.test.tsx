import type { Theme } from '@jobflow/shared';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { THEME_COOKIE } from './theme-cookie';
import { ThemeProvider, useTheme } from './theme-provider';

function renderTheme(initialTheme: Theme) {
  return renderHook(useTheme, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ThemeProvider initialTheme={initialTheme}>{children}</ThemeProvider>
    ),
  });
}

function pickTheme(theme: Theme) {
  const { result } = renderTheme('dark');
  act(() => {
    result.current.setTheme(theme);
  });
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    delete document.documentElement.dataset.theme;
    document.cookie = `${THEME_COOKIE}=; Path=/; Max-Age=0`;
  });

  it('starts from the theme the server rendered on html', () => {
    renderTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('paints a picked light theme and stores it in the cookie', () => {
    pickTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.cookie).toContain('jobflow_theme=light');
  });

  it('hands system mode back to the OS and stores it in the cookie', () => {
    pickTheme('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(document.cookie).toContain('jobflow_theme=system');
  });

  it('refuses useTheme outside ThemeProvider', () => {
    expect(() => renderHook(useTheme)).toThrow('useTheme must be used inside ThemeProvider');
  });
});
