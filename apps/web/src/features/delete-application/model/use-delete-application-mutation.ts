import type { ApplicationResponse } from '@jobflow/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { analyticsKeys } from '@/entities/analytics';
import { applicationKeys } from '@/entities/application';
import { uk } from '@/shared/i18n';
import { showErrorToast } from '@/shared/ui/error-toast';

import { deleteApplication } from '../api/delete-application';

export function useDeleteApplicationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (applicationId: ApplicationResponse['id']) => deleteApplication(applicationId),
    onSuccess: (_deleted, applicationId) => {
      queryClient.removeQueries({ queryKey: applicationKeys.detail(applicationId) });
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: applicationKeys.all }),
        queryClient.invalidateQueries({ queryKey: analyticsKeys.summary() }),
      ]);
    },
    onError: () => {
      showErrorToast(uk.applicationPage.deletion.failed);
    },
  });
}
