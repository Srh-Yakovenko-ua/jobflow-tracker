'use client';

import { AUTH_ROUTES, type FinishSearchInput } from '@jobflow/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { SEARCH_HISTORY_PATH, searchKeys } from '@/entities/search';
import { ApiError } from '@/shared/api';
import { uk } from '@/shared/i18n';
import { showErrorToast } from '@/shared/ui/error-toast';
import { showToast } from '@/shared/ui/toast';

import { finishSearch } from '../api/finish-search';

const COPY = uk.searches.finish;

function isConflict(error: Error): boolean {
  return error instanceof ApiError && error.status === 409;
}

export function useFinishSearchMutation() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (input: FinishSearchInput) => finishSearch(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      showToast({
        tone: 'success',
        title: COPY.archived.title,
        action: {
          label: COPY.archived.action,
          onAction: () => {
            router.push(SEARCH_HISTORY_PATH);
          },
        },
      });
      router.push(AUTH_ROUTES.home);
    },
    onError: (error) => {
      if (!isConflict(error)) {
        showErrorToast(uk.errors.saveFailed);
        return;
      }
      showErrorToast(COPY.conflict);
      void queryClient.invalidateQueries({ queryKey: searchKeys.all });
    },
  });
}
