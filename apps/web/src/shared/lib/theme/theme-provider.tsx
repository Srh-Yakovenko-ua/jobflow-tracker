'use client';

import type { Theme } from '@jobflow/shared';
import type { ReactNode } from 'react';
import { createContext, use, useEffect, useState } from 'react';

import { writeThemeCookie } from './theme-cookie';

export type ThemeContextValue = { theme: Theme; setTheme: (theme: Theme) => void };

const ThemeContext = createContext<ThemeContextValue | null>(null);

export type ThemeProviderProps = Readonly<{ children: ReactNode; initialTheme: Theme }>;

export function ThemeProvider({ children, initialTheme }: ThemeProviderProps) {
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    writeThemeCookie(theme);
    const root = document.documentElement;
    if (theme === 'system') {
      delete root.dataset.theme;
      return;
    }
    root.dataset.theme = theme;
  }, [theme]);

  return <ThemeContext value={{ theme, setTheme }}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const context = use(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return context;
}
