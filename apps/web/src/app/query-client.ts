import { QueryClient } from '@tanstack/react-query';

import { applicationKeys } from '@/entities/application';
import { isTransient } from '@/shared/api';
import { uk } from '@/shared/i18n';
import { showErrorToast } from '@/shared/ui/error-toast';

export const QUERY_DEFAULTS = { staleTimeMs: 30_000, queryRetries: 1 } as const;

function retryTransientOnce(failureCount: number, error: Error): boolean {
  return failureCount < QUERY_DEFAULTS.queryRetries && isTransient(error);
}

export function createQueryClient(): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_DEFAULTS.staleTimeMs,
        refetchOnWindowFocus: false,
        retry: retryTransientOnce,
      },
      mutations: {
        retry: false,
        onError: () => {
          showErrorToast(uk.errors.saveFailed);
        },
      },
    },
  });
  queryClient.setQueryDefaults(applicationKeys.boards(), { refetchOnWindowFocus: true });
  queryClient.setQueryDefaults(applicationKeys.tables(), { refetchOnWindowFocus: true });
  return queryClient;
}
