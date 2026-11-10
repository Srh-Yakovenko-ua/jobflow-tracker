import { useMutation, useQueryClient } from '@tanstack/react-query';

import { uk } from '@/shared/i18n';
import { showErrorToast } from '@/shared/ui/error-toast';
import { showToast } from '@/shared/ui/toast';

import { revokeCaptureTokens } from '../api/capture-tokens';
import { captureTokenKeys } from './keys';

const COPY = uk.bookmarklet.revoke;

export function useRevokeCaptureTokensMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeCaptureTokens,
    onSuccess: () => {
      showToast({ tone: 'success', ...COPY.done });
      return queryClient.invalidateQueries({ queryKey: captureTokenKeys.all });
    },
    onError: () => {
      showErrorToast(COPY.failed);
    },
  });
}
