import { useMutation, useQueryClient } from '@tanstack/react-query';

import { uk } from '@/shared/i18n';
import { showErrorToast } from '@/shared/ui/error-toast';
import { showToast } from '@/shared/ui/toast';

import { captureTokensQueryOptions, revokeCaptureTokens } from '../api/capture-tokens';
import { captureTokenKeys } from './keys';

const COPY = uk.bookmarklet.revoke;

const LIST_KEY = captureTokensQueryOptions().queryKey;

export function useRevokeCaptureTokensMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeCaptureTokens,
    onSuccess: (_, ids) => {
      showToast({ tone: 'success', ...COPY.done });
      queryClient.setQueryData(
        LIST_KEY,
        (list) => list && { items: list.items.filter((item) => !ids.includes(item.id)) },
      );
    },
    onError: () => {
      showErrorToast(COPY.failed);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: captureTokenKeys.all }),
  });
}
