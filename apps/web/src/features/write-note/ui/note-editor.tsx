'use client';

import { type ApplicationResponse, type Note, NOTE_LIMITS } from '@jobflow/shared';
import type { KeyboardEvent } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Field } from '@/shared/ui/field';
import { Textarea } from '@/shared/ui/textarea';

import { type KeyPress, markdownShortcutOf } from '../lib/markdown-shortcuts';
import { type NoteDraft, type NoteDraftStatus, useNoteDraft } from '../model/use-note-draft';

const COPY = uk.applicationPage.notes;

const STATUS_TEXT: Record<NoteDraftStatus, string> = {
  idle: '',
  saving: COPY.saving,
  saved: COPY.saved,
  failed: COPY.failed,
};

export type NoteEditorActions = Readonly<{ onDraftChange: (noteId: Note['id'] | null) => void }>;

export type NoteEditorProps = Readonly<{
  application: ApplicationResponse;
  actions: NoteEditorActions;
}>;

function pressOf(event: KeyboardEvent<HTMLTextAreaElement>): KeyPress {
  const { key, code, ctrlKey, metaKey, shiftKey, altKey } = event;
  return { key, code, mod: ctrlKey || metaKey, shift: shiftKey, alt: altKey };
}

function keyHandlerOf(draft: NoteDraft) {
  return (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;
    const press = pressOf(event);
    if (press.mod && press.key === 'Enter') {
      event.preventDefault();
      draft.finish();
      return;
    }
    const field = event.currentTarget;
    const next = markdownShortcutOf({ field, press });
    if (next === null || next.value.length > NOTE_LIMITS.bodyMaxLength) return;
    event.preventDefault();
    field.value = next.value;
    field.setSelectionRange(next.selectionStart, next.selectionEnd);
    draft.onChange(next.value);
  };
}

export function NoteEditor({ application, actions }: NoteEditorProps) {
  const draft = useNoteDraft({ applicationId: application.id, ...actions });
  const counter = { value: draft.body.length, max: NOTE_LIMITS.bodyMaxLength };
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Field
        label={<span className="sr-only">{COPY.label}</span>}
        footer={{ hint: COPY.finishHint, counter }}
      >
        <Textarea
          value={draft.body}
          onChange={(event) => {
            draft.onChange(event.target.value);
          }}
          onKeyDown={keyHandlerOf(draft)}
          maxLength={NOTE_LIMITS.bodyMaxLength}
          placeholder={COPY.placeholder}
          className="min-h-16 text-body-l"
        />
      </Field>
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={cn(
          'caption min-h-[1lh]',
          draft.status === 'failed' ? 'text-danger' : 'text-ink-3',
        )}
      >
        {STATUS_TEXT[draft.status]}
      </p>
    </div>
  );
}
