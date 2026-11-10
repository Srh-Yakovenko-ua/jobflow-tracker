import { useMutation, useQueryClient } from '@tanstack/react-query';

import { uk } from '@/shared/i18n';
import { showErrorToast } from '@/shared/ui/error-toast';
import { showToast } from '@/shared/ui/toast';

import { captureTokensQueryOptions, createCaptureToken } from '../api/capture-tokens';
import { captureTokenKeys } from './keys';

const COPY = uk.bookmarklet;

const LIST_KEY = captureTokensQueryOptions().queryKey;

export function useCreateCaptureTokenMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCaptureToken,
    gcTime: 0,
    onSuccess: () => {
      const replaced = queryClient.getQueryData(LIST_KEY)?.items ?? [];
      showToast({
        tone: 'success',
        ...(replaced.length > 0 ? COPY.regenerate.done : COPY.created),
      });
      return queryClient.invalidateQueries({ queryKey: captureTokenKeys.all });
    },
    onError: () => {
      showErrorToast(COPY.createFailed);
    },
  });
}
