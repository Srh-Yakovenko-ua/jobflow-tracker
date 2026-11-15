'use client';

import {
  type ApplicationResponse,
  NOTE_TOPIC_LABELS,
  type NoteTopic,
  type TimelineItem,
} from '@jobflow/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { timelineKeys } from '@/entities/application';
import { addNote, noteKeys } from '@/entities/note';
import { useUserStorageKey } from '@/entities/user';
import { isIdempotencyConflict, useSubmitKey } from '@/shared/api';
import { uk } from '@/shared/i18n';
import { useStoredJson } from '@/shared/lib/use-stored-json';
import { showErrorToast } from '@/shared/ui/error-toast';

export type AskedTopicsInput = Readonly<{
  application: ApplicationResponse;
  itemId: TimelineItem['id'];
  actions: Readonly<{ onClosed: () => void }>;
}>;

export type AskedTopics = Readonly<{
  open: boolean;
  saving: boolean;
  save: (topics: readonly NoteTopic[]) => void;
  skip: () => void;
}>;

const answeredSchema = z.array(z.string());

function noteBodyOf(topics: readonly NoteTopic[]) {
  return {
    body: uk.interviewPrep.asked.note(topics.map((topic) => NOTE_TOPIC_LABELS[topic].labelUk)),
  };
}

function useSaveAskedTopics({
  application,
  onSaved,
}: Readonly<{ application: ApplicationResponse; onSaved: () => void }>) {
  const queryClient = useQueryClient();
  const submitKey = useSubmitKey();
  return useMutation({
    mutationFn: (topics: readonly NoteTopic[]) => {
      const body = noteBodyOf(topics);
      return addNote({
        applicationId: application.id,
        body,
        idempotencyKey: submitKey.keyFor(body),
      });
    },
    onSuccess: () => {
      submitKey.reset();
      onSaved();
      void queryClient.invalidateQueries({ queryKey: timelineKeys.detail(application.id) });
      void queryClient.invalidateQueries({ queryKey: noteKeys.list(application.id) });
    },
    onError: (error) => {
      showErrorToast(
        isIdempotencyConflict(error) ? uk.add.errors.stillRunning : uk.errors.saveFailed,
      );
    },
  });
}

export function useAskedTopics({ application, itemId, actions }: AskedTopicsInput): AskedTopics {
  const key = useUserStorageKey('asked-topics');
  const answered = useStoredJson({ key, schema: answeredSchema, fallback: [] });
  const close = () => {
    answered.store([...answered.value, itemId]);
    actions.onClosed();
  };
  const mutation = useSaveAskedTopics({ application, onSaved: close });
  return {
    open: key !== undefined && !answered.value.includes(itemId),
    saving: mutation.isPending,
    save: (topics) => {
      mutation.mutate(topics);
    },
    skip: close,
  };
}
