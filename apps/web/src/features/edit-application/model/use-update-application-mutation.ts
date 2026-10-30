import type { ApplicationResponse, UpdateApplicationInput } from '@jobflow/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseFormSetError } from 'react-hook-form';

import { applicationKeys } from '@/entities/application';
import { ApiError, applyFieldErrors } from '@/shared/api';
import { uk } from '@/shared/i18n';
import { showErrorToast } from '@/shared/ui/error-toast';

import { updateApplication } from '../api/update-application';
import { EDIT_FIELDS, type EditFormValues } from './edit-form';

export type UseUpdateApplicationMutationOptions = Readonly<{
  applicationId: ApplicationResponse['id'];
  setError: UseFormSetError<EditFormValues>;
}>;

export function useUpdateApplicationMutation({
  applicationId,
  setError,
}: UseUpdateApplicationMutationOptions) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateApplicationInput) => updateApplication({ applicationId, body }),
    onSuccess: (response) => {
      queryClient.setQueryData(applicationKeys.detail(applicationId), response);
      void queryClient.invalidateQueries({ queryKey: applicationKeys.boards() });
      void queryClient.invalidateQueries({ queryKey: applicationKeys.lists() });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 422) {
        applyFieldErrors({ error, fields: EDIT_FIELDS, setError });
        return;
      }
      showErrorToast(uk.errors.saveFailed);
    },
  });
}
