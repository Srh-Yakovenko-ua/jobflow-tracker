import type { Note, NoteListResponse } from '@jobflow/shared';
import {
  type DefaultError,
  type MutationStatus,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { type RefObject, useEffect, useEffectEvent, useRef, useState } from 'react';

import { timelineKeys } from '@/entities/application';
import { noteKeys } from '@/entities/note';

import {
  type DraftRecord,
  type DraftSaved,
  EMPTY_DRAFT,
  notesAfter,
  saveDraft,
} from './save-draft';

export const NOTE_DRAFT_LIMITS = { saveAfterMs: 1000 } as const;

export type NoteDraftStatus = 'idle' | 'saving' | 'saved' | 'failed';

export type NoteDraftOptions = Readonly<{
  applicationId: Note['applicationId'];
  onDraftChange: (noteId: Note['id'] | null) => void;
}>;

type DraftSaveCause = 'autosave' | 'finish' | 'leave';

type DraftSent = Readonly<{ saved: DraftSaved; body: string }>;

type DraftMutationOptions = NoteDraftOptions &
  Readonly<{
    draft: RefObject<DraftRecord>;
    latest: RefObject<string>;
    onFinished: () => void;
    onFailed: () => void;
  }>;

type DraftEnd = Readonly<{ sent: DraftSent; cause: DraftSaveCause; draft: DraftRecord }>;

type LeaveHandlers = Readonly<{ onPageHide: () => void; onUnmount: () => void }>;

type DraftIdChange = Readonly<{ noteId: Note['id'] | null }> | null;

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

function useDraftMutation({ applicationId, draft, latest, ...handlers }: DraftMutationOptions) {
  const queryClient = useQueryClient();
  return useMutation<DraftSent, DefaultError, DraftSaveCause>({
    scope: { id: `note-draft-${applicationId}` },
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
      const finished = cause === 'finish' && latest.current === sent.body;
      if (finished) handlers.onFinished();
      if (!finished && !endsOpenDraft({ sent, cause, draft: draft.current })) return;
      void queryClient.invalidateQueries({ queryKey: timelineKeys.detail(applicationId) });
    },
    onError: handlers.onFailed,
  });
}

function useSaveOnLeave(handlers: LeaveHandlers) {
  const onPageHide = useEffectEvent(handlers.onPageHide);
  const onUnmount = useEffectEvent(handlers.onUnmount);
  useEffect(() => {
    const pageHide = () => {
      onPageHide();
    };
    window.addEventListener('pagehide', pageHide);
    return () => {
      window.removeEventListener('pagehide', pageHide);
      onUnmount();
    };
  }, []);
}

function useLatestBody() {
  const latestRef = useRef('');
  const [body, setBody] = useState('');
  const write = (next: string) => {
    latestRef.current = next;
    setBody(next);
  };
  return { body, latestRef, write };
}

function useSaveTimer() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  return {
    start: (save: () => void) => {
      timerRef.current ??= setTimeout(save, NOTE_DRAFT_LIMITS.saveAfterMs);
    },
    stop: () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = null;
    },
  };
}

function isNothingToFinish(text: string, draft: DraftRecord): boolean {
  return text.trim() === '' && draft.noteId === null;
}

function useDraftSaves(options: NoteDraftOptions) {
  const draftRef = useRef<DraftRecord>(EMPTY_DRAFT);
  const unsavedRef = useRef(false);
  const timer = useSaveTimer();
  const latest = useLatestBody();
  const mutation = useDraftMutation({
    ...options,
    draft: draftRef,
    latest: latest.latestRef,
    onFailed: () => {
      unsavedRef.current = true;
    },
    onFinished: () => {
      draftRef.current = EMPTY_DRAFT;
      latest.write('');
      options.onDraftChange(null);
    },
  });
  const send = (cause: DraftSaveCause) => {
    timer.stop();
    unsavedRef.current = false;
    mutation.mutate(cause);
  };
  return { ...latest, draftRef, unsavedRef, timer, send, status: STATUS_OF[mutation.status] };
}

export function useNoteDraft(options: NoteDraftOptions) {
  const { body, latestRef, write, draftRef, unsavedRef, timer, send, status } =
    useDraftSaves(options);
  const flush = () => {
    if (unsavedRef.current) send('autosave');
  };
  useSaveOnLeave({
    onPageHide: flush,
    onUnmount: () => {
      if (unsavedRef.current || !isNothingToFinish(latestRef.current, draftRef.current)) {
        send('leave');
      }
    },
  });
  return {
    body,
    status,
    onChange: (next: string) => {
      write(next);
      unsavedRef.current = true;
      timer.start(flush);
    },
    finish: () => {
      if (!isNothingToFinish(latestRef.current, draftRef.current)) send('finish');
    },
  };
}

export type NoteDraft = ReturnType<typeof useNoteDraft>;
