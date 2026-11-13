import type { Theme } from '@jobflow/shared';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

import { ThemeProvider } from '@/shared/lib/theme';

export function renderHookInTheme<Result>(hook: () => Result, initialTheme: Theme) {
  return renderHook(hook, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ThemeProvider initialTheme={initialTheme}>{children}</ThemeProvider>
    ),
  });
}
