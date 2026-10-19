'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Toaster } from 'sonner';

import { ThemeProvider, useTheme } from '@/shared/lib/theme';

export type ProvidersProps = Readonly<{ children: ReactNode }>;

function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster theme={theme} />;
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {children}
        <ThemedToaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
