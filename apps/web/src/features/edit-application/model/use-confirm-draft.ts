import type { ApplicationResponse, UpdateApplicationInput } from '@jobflow/shared';
import { type QueryKey, useQueryClient } from '@tanstack/react-query';
import type { UseFormSetError } from 'react-hook-form';

import { applicationKeys, timelineKeys } from '@/entities/application';
import { ApiError, type GuardedSave, useGuardedSave } from '@/shared/api';

import { confirmDraft } from '../api/confirm-draft';
import { updateApplication } from '../api/update-application';
import { EDIT_FIELDS, type EditFormValues } from './edit-form';

export type UseConfirmDraftOptions = Readonly<{
  applicationId: ApplicationResponse['id'];
  setError: UseFormSetError<EditFormValues>;
  actions: { onConfirmed: () => void };
}>;

type ConfirmOutcome = 'confirmed' | 'stale';

function confirmKeyOf(applicationId: ApplicationResponse['id']) {
  return ['draft-confirm', applicationId] as const;
}

export function useConfirmDraft({
  applicationId,
  setError,
  actions,
}: UseConfirmDraftOptions): GuardedSave<UpdateApplicationInput | null> {
  const queryClient = useQueryClient();
  const refresh = (queryKey: QueryKey) => {
    void queryClient.invalidateQueries({ queryKey });
  };
  return useGuardedSave({
    mutationKey: confirmKeyOf(applicationId),
    request: async (body: UpdateApplicationInput | null): Promise<ConfirmOutcome> => {
      try {
        if (body !== null) await updateApplication({ applicationId, body });
        await confirmDraft(applicationId);
        return 'confirmed';
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) return 'stale';
        throw error;
      }
    },
    form: { fields: EDIT_FIELDS, setError },
    onSuccess: (outcome) => {
      refresh(applicationKeys.detail(applicationId));
      refresh(applicationKeys.boards());
      if (outcome === 'stale') return;
      refresh(applicationKeys.lists());
      refresh(timelineKeys.detail(applicationId));
      actions.onConfirmed();
    },
  });
}
