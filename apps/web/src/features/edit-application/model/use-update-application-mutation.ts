import type { ApplicationResponse, UpdateApplicationInput } from '@jobflow/shared';
import { useQueryClient } from '@tanstack/react-query';
import type { UseFormSetError } from 'react-hook-form';

import { applicationKeys } from '@/entities/application';
import { type GuardedSave, useGuardedSave } from '@/shared/api';

import { updateApplication } from '../api/update-application';
import { EDIT_FIELDS, type EditFormValues } from './edit-form';

export type UseUpdateApplicationMutationOptions = Readonly<{
  applicationId: ApplicationResponse['id'];
  setError: UseFormSetError<EditFormValues>;
  onSaved: () => void;
}>;

function updateKeyOf(applicationId: ApplicationResponse['id']) {
  return ['application-update', applicationId] as const;
}

export function useUpdateApplicationMutation({
  applicationId,
  setError,
  onSaved,
}: UseUpdateApplicationMutationOptions): GuardedSave<UpdateApplicationInput> {
  const queryClient = useQueryClient();
  return useGuardedSave({
    mutationKey: updateKeyOf(applicationId),
    request: (body: UpdateApplicationInput) => updateApplication({ applicationId, body }),
    form: { fields: EDIT_FIELDS, setError },
    onSuccess: (response) => {
      queryClient.setQueryData(applicationKeys.detail(applicationId), response);
      void queryClient.invalidateQueries({ queryKey: applicationKeys.boards() });
      void queryClient.invalidateQueries({ queryKey: applicationKeys.lists() });
      onSaved();
    },
  });
}
