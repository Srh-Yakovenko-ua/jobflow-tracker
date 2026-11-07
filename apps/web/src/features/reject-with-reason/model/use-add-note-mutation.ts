import type { ApplicationCard, NoteInput } from '@jobflow/shared';
import { useQueryClient } from '@tanstack/react-query';
import type { UseFormSetError } from 'react-hook-form';

import { timelineKeys } from '@/entities/application';
import { addNote, noteKeys } from '@/entities/note';
import { type GuardedSave, useGuardedSave, useSubmitKey } from '@/shared/api';

export type UseAddNoteMutationOptions = Readonly<{
  applicationId: ApplicationCard['id'];
  setError: UseFormSetError<NoteInput>;
  onSaved: () => void;
}>;

const NOTE_FIELDS = ['body'] as const;

function noteKeyOf(applicationId: ApplicationCard['id']) {
  return ['rejection-note', applicationId] as const;
}

export function useAddNoteMutation({
  applicationId,
  setError,
  onSaved,
}: UseAddNoteMutationOptions): GuardedSave<NoteInput> {
  const queryClient = useQueryClient();
  const submitKey = useSubmitKey();
  return useGuardedSave({
    mutationKey: noteKeyOf(applicationId),
    request: (body: NoteInput) =>
      addNote({ applicationId, body, idempotencyKey: submitKey.keyFor(body) }),
    form: { fields: NOTE_FIELDS, setError },
    onSuccess: async () => {
      submitKey.reset();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: timelineKeys.detail(applicationId) }),
        queryClient.invalidateQueries({ queryKey: noteKeys.list(applicationId) }),
      ]);
      onSaved();
    },
  });
}
