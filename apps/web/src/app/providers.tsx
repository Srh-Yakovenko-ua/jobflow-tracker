'use client';

import type { Theme } from '@jobflow/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Toaster } from 'sonner';

import { uk } from '@/shared/i18n';
import { ThemeProvider, useTheme } from '@/shared/lib/theme';

export type ProvidersProps = Readonly<{ children: ReactNode; theme: Theme }>;

function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster theme={theme} containerAriaLabel={uk.app.notifications} />;
}

export function Providers({ children, theme }: ProvidersProps) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider initialTheme={theme}>
        {children}
        <ThemedToaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
