'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type Note, NOTE_LIMITS, noteInputSchema } from '@jobflow/shared';
import { type ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';

import { NoteMarkdown } from '@/entities/note';
import { uk } from '@/shared/i18n';
import { useFieldError } from '@/shared/lib/use-field-error';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { Field } from '@/shared/ui/field';
import { InlineEditorForm } from '@/shared/ui/inline-editor-form';
import { Textarea } from '@/shared/ui/textarea';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import { useDeleteNoteMutation, useEditNoteMutation } from '../model/use-saved-note-mutations';

export type SavedNoteProps = Readonly<{ note: Note; context: ReactNode }>;

type NoteEditFormProps = Readonly<{ note: Note; actions: { onDone: () => void } }>;

type NoteActionsProps = Readonly<{
  note: Note;
  edit: { refocus: boolean; onEdit: () => void };
}>;

type SavedNoteMode = 'view' | 'edit' | 'edited';

const COPY = uk.applicationPage.notes;

const resolver = zodResolver(noteInputSchema);

function NoteEditForm({ note, actions }: NoteEditFormProps) {
  const methods = useForm({ mode: 'onTouched', defaultValues: { body: note.body }, resolver });
  const edit = useEditNoteMutation({ note, setError: methods.setError, onDone: actions.onDone });
  const error = useFieldError({ control: methods.control, name: 'body', messages: COPY.errors });
  return (
    <InlineEditorForm
      form={{
        control: methods.control,
        onSubmit: methods.handleSubmit(edit.save),
        pending: edit.isPending,
      }}
      actions={{ onCancel: actions.onDone }}
      className="gap-3"
    >
      <Field label={COPY.editLabel} footer={{ error }}>
        <Textarea
          autoFocus
          maxLength={NOTE_LIMITS.bodyMaxLength}
          className="min-h-16 text-body-l"
          {...methods.register('body')}
        />
      </Field>
    </InlineEditorForm>
  );
}

function NoteActions({ note, edit }: NoteActionsProps) {
  const remove = useDeleteNoteMutation(note);
  return (
    <span className="flex flex-none items-center gap-1">
      <Button
        autoFocus={edit.refocus}
        variant="ghost"
        size="xs"
        className={TOUCH_HEIGHT}
        onClick={edit.onEdit}
      >
        {COPY.edit}
      </Button>
      <ConfirmDialog
        trigger={{ label: COPY.delete.confirm, variant: 'ghost' }}
        copy={COPY.delete}
        action={{
          pending: remove.isPending,
          onConfirm: (close) => {
            remove.mutate(undefined, { onSuccess: close });
          },
        }}
      />
    </span>
  );
}

export function SavedNote({ note, context }: SavedNoteProps) {
  const [mode, setMode] = useState<SavedNoteMode>('view');
  if (mode === 'edit') {
    return (
      <NoteEditForm
        note={note}
        actions={{
          onDone: () => {
            setMode('edited');
          },
        }}
      />
    );
  }
  return (
    <>
      <span className="flex items-center justify-between gap-2">
        {context}
        <NoteActions
          note={note}
          edit={{
            refocus: mode === 'edited',
            onEdit: () => {
              setMode('edit');
            },
          }}
        />
      </span>
      <NoteMarkdown note={note} />
    </>
  );
}
