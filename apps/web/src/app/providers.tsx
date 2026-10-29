'use client';

import type { Theme } from '@jobflow/shared';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { LucideProvider } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Toaster } from 'sonner';

import { uk } from '@/shared/i18n';
import { ThemeProvider, useTheme } from '@/shared/lib/theme';

import { createQueryClient } from './query-client';

export type ProvidersProps = Readonly<{ children: ReactNode; theme: Theme }>;

function ThemedToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      theme={theme}
      containerAriaLabel={uk.app.notifications}
      position="bottom-center"
      offset={26}
    />
  );
}

export function Providers({ children, theme }: ProvidersProps) {
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider initialTheme={theme}>
        <LucideProvider strokeWidth={1.9} size={16}>
          {children}
          <ThemedToaster />
        </LucideProvider>
      </ThemeProvider>
      <ReactQueryDevtools buttonPosition="bottom-left" />
    </QueryClientProvider>
  );
}
