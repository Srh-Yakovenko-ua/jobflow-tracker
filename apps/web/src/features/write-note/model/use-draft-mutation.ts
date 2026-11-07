import type { Note, NoteListResponse } from '@jobflow/shared';
import {
  type DefaultError,
  type MutationStatus,
  type QueryClient,
  useMutation,
  type UseMutationOptions,
  useQueryClient,
} from '@tanstack/react-query';
import type { RefObject } from 'react';

import { timelineKeys } from '@/entities/application';
import { noteKeys } from '@/entities/note';

import { type DraftRecord, type DraftSaved, notesAfter, saveDraft } from './save-draft';

export type NoteDraftStatus = 'idle' | 'saving' | 'saved' | 'failed';

export type DraftSaveCause = 'autosave' | 'finish' | 'leave';

export type DraftMutationOptions = Readonly<{
  applicationId: Note['applicationId'];
  draft: RefObject<DraftRecord>;
  latest: RefObject<string>;
  onDraftChange: (noteId: Note['id'] | null) => void;
  onFinished: () => void;
  onFailed: () => void;
  onBehind: () => void;
}>;

type DraftSent = Readonly<{ saved: DraftSaved; body: string }>;

type DraftEnd = Readonly<{ sent: DraftSent; cause: DraftSaveCause; draft: DraftRecord }>;

type DraftIdChange = Readonly<{ noteId: Note['id'] | null }> | null;

type DraftOptionsInput = DraftMutationOptions & Readonly<{ queryClient: QueryClient }>;

const STATUS_OF: Record<MutationStatus, NoteDraftStatus> = {
  idle: 'idle',
  pending: 'saving',
  success: 'saved',
  error: 'failed',
};

function draftIdChangeOf(saved: DraftSaved): DraftIdChange {
  if (saved.kind === 'deleted') return { noteId: null };
  return saved.kind === 'written' && saved.created ? { noteId: saved.note.id } : null;
}

function endsOpenDraft({ sent, cause, draft }: DraftEnd): boolean {
  return sent.saved.kind === 'deleted' || (cause === 'leave' && draft.noteId !== null);
}

function draftKeyOf(applicationId: Note['applicationId']) {
  return ['note-draft', applicationId] as const;
}

function draftOptionsOf(
  input: DraftOptionsInput,
): UseMutationOptions<DraftSent, DefaultError, DraftSaveCause> {
  const { applicationId, draft, latest, queryClient, ...handlers } = input;
  return {
    networkMode: 'always',
    mutationFn: async () => {
      const body = latest.current;
      return { body, saved: await saveDraft({ applicationId, draft, body }) };
    },
    onSuccess: (sent, cause) => {
      queryClient.setQueryData<NoteListResponse>(
        noteKeys.list(applicationId),
        (list) => list && notesAfter(list, sent.saved),
      );
      const change = draftIdChangeOf(sent.saved);
      if (change !== null) handlers.onDraftChange(change.noteId);
      const current = latest.current === sent.body;
      const finished = cause === 'finish' && current;
      if (!current) handlers.onBehind();
      if (finished) handlers.onFinished();
      if (!finished && !endsOpenDraft({ sent, cause, draft: draft.current })) return;
      void queryClient.invalidateQueries({ queryKey: timelineKeys.detail(applicationId) });
    },
    onError: handlers.onFailed,
  };
}

export function useDraftMutations(options: DraftMutationOptions) {
  const queryClient = useQueryClient();
  const mutationKey = draftKeyOf(options.applicationId);
  const shared = draftOptionsOf({ ...options, queryClient });
  const serial = useMutation({
    ...shared,
    mutationKey,
    scope: { id: `note-draft-${options.applicationId}` },
  });
  const direct = useMutation(shared);
  return {
    status: STATUS_OF[serial.status],
    serial: serial.mutate,
    direct: direct.mutate,
    inFlight: () => queryClient.isMutating({ mutationKey }) > 0,
  };
}
