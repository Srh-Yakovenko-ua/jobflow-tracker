'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type ApplicationCard, type NoteInput, noteInputSchema } from '@jobflow/shared';
import { type FieldErrors, useForm } from 'react-hook-form';

import { uk } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';
import { DialogFooter } from '@/shared/ui/dialog';
import { Field } from '@/shared/ui/field';
import { Textarea } from '@/shared/ui/textarea';
import { showToast } from '@/shared/ui/toast';

import type { RejectionActions } from '../model/rejection-step';
import { useAddNoteMutation } from '../model/use-add-note-mutation';

const COPY = uk.board.reject.note;

const EMPTY_NOTE: NoteInput = { body: '' };

export type RejectionNoteProps = Readonly<{
  application: ApplicationCard;
  actions: Pick<RejectionActions, 'onDone'>;
}>;

function noteErrorOf(errors: FieldErrors<NoteInput>): string | undefined {
  const error = errors.body;
  if (error === undefined) return errors.root?.server?.message;
  if (error.type === 'server') return error.message;
  return error.type === 'too_big' ? COPY.tooLong : COPY.blank;
}

export function RejectionNote({ application, actions }: RejectionNoteProps) {
  const form = useForm<NoteInput>({
    defaultValues: EMPTY_NOTE,
    resolver: zodResolver(noteInputSchema),
  });
  const mutation = useAddNoteMutation({ applicationId: application.id, setError: form.setError });
  const submit = form.handleSubmit((note) => {
    mutation.mutate(note, {
      onSuccess: () => {
        showToast({ tone: 'success', title: COPY.saved });
        actions.onDone();
      },
    });
  });
  return (
    <form
      noValidate
      onSubmit={(event) => {
        void submit(event);
      }}
      className="flex flex-col gap-4.5"
    >
      <Field label={COPY.label} footer={{ error: noteErrorOf(form.formState.errors) }}>
        <Textarea autoFocus {...form.register('body')} />
      </Field>
      <DialogFooter className="justify-end">
        <Button type="submit" loading={mutation.isPending}>
          {COPY.save}
        </Button>
      </DialogFooter>
    </form>
  );
}
