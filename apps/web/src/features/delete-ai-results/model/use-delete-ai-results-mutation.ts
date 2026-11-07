import { useMutation, useQueryClient } from '@tanstack/react-query';

import { applicationKeys } from '@/entities/application';
import { resumeKeys } from '@/entities/resume';
import { uk } from '@/shared/i18n';
import { showErrorToast } from '@/shared/ui/error-toast';
import { showToast } from '@/shared/ui/toast';

import { deleteAiResults } from '../api/delete-ai-results';

const COPY = uk.settings.aiPrivacy.dataDeletion;

export function useDeleteAiResultsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAiResults,
    onSuccess: () => {
      showToast({ tone: 'success', title: COPY.deleted });
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: applicationKeys.all }),
        queryClient.invalidateQueries({ queryKey: resumeKeys.all }),
      ]);
    },
    onError: () => {
      showErrorToast(COPY.failed);
    },
  });
}
