'use client';

import { useMediaQuery } from '../use-media-query';
import { useTheme } from './theme-provider';

export type ShownScheme = 'light' | 'dark';

const DARK_SCHEME = '(prefers-color-scheme: dark)';

export function useShownScheme(): ShownScheme {
  const { theme } = useTheme();
  const prefersDark = useMediaQuery(DARK_SCHEME);
  return theme === 'dark' || (theme === 'system' && prefersDark) ? 'dark' : 'light';
}
