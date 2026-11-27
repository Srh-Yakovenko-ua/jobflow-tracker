import type { Note, NoteInput, NoteListResponse } from '@jobflow/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseFormSetError } from 'react-hook-form';

import { timelineKeys } from '@/entities/application';
import { deleteNote, noteKeys, updateNote } from '@/entities/note';
import { type GuardedSave, useGuardedSave } from '@/shared/api';
import { uk } from '@/shared/i18n';
import { showErrorToast } from '@/shared/ui/error-toast';

import { type DraftSaved, notesAfter } from './save-draft';

export type EditNoteOptions = Readonly<{
  note: Note;
  setError: UseFormSetError<NoteInput>;
  onDone: () => void;
}>;

const EDIT_FIELDS = ['body'] as const;

const EDIT_KEY = [...noteKeys.all, 'edit'] as const;

function useNoteListUpdate(applicationId: Note['applicationId']) {
  const queryClient = useQueryClient();
  return (saved: DraftSaved) => {
    queryClient.setQueryData<NoteListResponse>(
      noteKeys.list(applicationId),
      (list) => list && notesAfter(list, saved),
    );
    return queryClient.invalidateQueries({ queryKey: timelineKeys.detail(applicationId) });
  };
}

export function useEditNoteMutation({
  note,
  setError,
  onDone,
}: EditNoteOptions): GuardedSave<NoteInput> {
  const listUpdate = useNoteListUpdate(note.applicationId);
  return useGuardedSave({
    mutationKey: EDIT_KEY,
    request: (body: NoteInput) =>
      updateNote({ applicationId: note.applicationId, noteId: note.id, body, keepalive: false }),
    form: { fields: EDIT_FIELDS, setError },
    onSuccess: (saved) => listUpdate({ kind: 'written', note: saved, created: false }),
    onSaved: onDone,
  });
}

export function useDeleteNoteMutation(note: Note) {
  const listUpdate = useNoteListUpdate(note.applicationId);
  return useMutation({
    mutationFn: () =>
      deleteNote({ applicationId: note.applicationId, noteId: note.id, keepalive: false }),
    onSuccess: () => listUpdate({ kind: 'deleted', noteId: note.id }),
    onError: () => {
      showErrorToast(uk.applicationPage.notes.deleteFailed);
    },
  });
}
