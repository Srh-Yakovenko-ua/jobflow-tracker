import type { ApplicationCard, NoteInput } from '@jobflow/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseFormSetError } from 'react-hook-form';

import { timelineKeys } from '@/entities/application';
import { ApiError, applyFieldErrors } from '@/shared/api';
import { uk } from '@/shared/i18n';
import { showErrorToast } from '@/shared/ui/error-toast';

import { addNote } from '../api/add-note';

export type UseAddNoteMutationOptions = Readonly<{
  applicationId: ApplicationCard['id'];
  setError: UseFormSetError<NoteInput>;
}>;

const NOTE_FIELDS = ['body'] as const;

export function useAddNoteMutation({ applicationId, setError }: UseAddNoteMutationOptions) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: NoteInput) => addNote({ applicationId, body }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: timelineKeys.detail(applicationId) }),
    onError: (error) => {
      if (error instanceof ApiError && error.status === 422) {
        applyFieldErrors({ error, fields: NOTE_FIELDS, setError });
        return;
      }
      showErrorToast(uk.errors.saveFailed);
    },
  });
}
