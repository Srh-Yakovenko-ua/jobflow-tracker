import { QueryClient } from '@tanstack/react-query';

import { applicationKeys } from '@/entities/application';
import { ApiError } from '@/shared/api';
import { uk } from '@/shared/i18n';
import { showErrorToast } from '@/shared/ui/error-toast';

export const QUERY_DEFAULTS = { staleTimeMs: 30_000, queryRetries: 1 } as const;

const TRANSIENT_ERROR_NAMES = new Set(['TypeError', 'TimeoutError']);

function isTransient(error: Error): boolean {
  if (error instanceof ApiError) {
    return error.status >= 500;
  }
  return TRANSIENT_ERROR_NAMES.has(error.name);
}

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
  return queryClient;
}
