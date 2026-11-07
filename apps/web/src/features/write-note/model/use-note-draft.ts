import { type RefObject, useEffect, useRef, useState } from 'react';

import { type DraftRecord, EMPTY_DRAFT } from './save-draft';
import {
  type DraftMutationOptions,
  type DraftSaveCause,
  useDraftMutations,
} from './use-draft-mutation';
import { useSaveOnLeave } from './use-save-on-leave';

export type { NoteDraftStatus } from './use-draft-mutation';

export const NOTE_DRAFT_LIMITS = { saveAfterMs: 1000 } as const;

export type NoteDraftOptions = Pick<DraftMutationOptions, 'applicationId' | 'onDraftChange'>;

type SaveTimerRef = RefObject<ReturnType<typeof setTimeout> | null>;

type DraftSend = (cause: DraftSaveCause) => void;

function clearTimer(timer: SaveTimerRef) {
  if (timer.current !== null) clearTimeout(timer.current);
  timer.current = null;
}

function useSaveTimer() {
  const timerRef: SaveTimerRef = useRef(null);
  const liveRef = useRef(false);
  useEffect(() => {
    liveRef.current = true;
    return () => {
      liveRef.current = false;
      clearTimer(timerRef);
    };
  }, []);
  return {
    start: (save: () => void) => {
      if (!liveRef.current || timerRef.current !== null) return;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        save();
      }, NOTE_DRAFT_LIMITS.saveAfterMs);
    },
    stop: () => {
      clearTimer(timerRef);
    },
  };
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

function useDraftSaves(options: NoteDraftOptions) {
  const draftRef = useRef<DraftRecord>(EMPTY_DRAFT);
  const unsavedRef = useRef(false);
  const timer = useSaveTimer();
  const latest = useLatestBody();
  const markUnsaved = () => {
    unsavedRef.current = true;
    timer.start(autosave);
  };
  const saves = useDraftMutations({
    ...options,
    draft: draftRef,
    latest: latest.latestRef,
    onFailed: markUnsaved,
    onBehind: markUnsaved,
    onFinished: () => {
      draftRef.current = EMPTY_DRAFT;
      latest.write('');
      options.onDraftChange(null);
    },
  });
  const send = (save: DraftSend, cause: DraftSaveCause) => {
    timer.stop();
    unsavedRef.current = false;
    save(cause);
  };
  const autosave = () => {
    if (unsavedRef.current) send(saves.serial, 'autosave');
  };
  return { ...latest, draftRef, unsavedRef, saves, send, markUnsaved };
}

export function useNoteDraft(options: NoteDraftOptions) {
  const { body, latestRef, write, draftRef, unsavedRef, saves, send, markUnsaved } =
    useDraftSaves(options);
  const hasSomethingToFinish = () =>
    latestRef.current.trim() !== '' || draftRef.current.noteId !== null;
  useSaveOnLeave({
    onHide: () => {
      if (!unsavedRef.current) return;
      const beside = draftRef.current.noteId !== null && saves.inFlight();
      send(beside ? saves.direct : saves.serial, 'autosave');
    },
    onUnmount: () => {
      if (unsavedRef.current || hasSomethingToFinish()) send(saves.serial, 'leave');
    },
  });
  return {
    body,
    status: saves.status,
    onChange: (next: string) => {
      write(next);
      markUnsaved();
    },
    finish: () => {
      if (hasSomethingToFinish()) send(saves.serial, 'finish');
    },
  };
}

export type NoteDraft = ReturnType<typeof useNoteDraft>;
