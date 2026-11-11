'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { ResumeVersion } from '@jobflow/shared';
import { useForm } from 'react-hook-form';

import {
  VersionTitleField,
  type VersionTitleForm,
  versionTitleFormSchema,
} from '@/entities/resume';
import { uk } from '@/shared/i18n';
import { useLastPresent } from '@/shared/lib/use-last-present';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  type DialogContentHandlers,
  DialogFooter,
} from '@/shared/ui/dialog';
import { FormServerError } from '@/shared/ui/form-server-error';

import { useRenameVersionMutation } from '../model/use-version-mutations';

const COPY = uk.resumes.rename;

export type RenameDialogActions = Readonly<{ onClose: () => void }>;

export type RenameVersionDialogProps = Readonly<{
  version: ResumeVersion | null;
  actions: RenameDialogActions;
  handlers?: Pick<DialogContentHandlers, 'onCloseAutoFocus'>;
}>;

type RenameFormProps = Readonly<{ version: ResumeVersion; actions: RenameDialogActions }>;

function RenameForm({ version, actions }: RenameFormProps) {
  const methods = useForm<VersionTitleForm>({
    mode: 'onTouched',
    defaultValues: { title: version.title },
    resolver: zodResolver(versionTitleFormSchema),
  });
  const rename = useRenameVersionMutation({
    versionId: version.id,
    setError: methods.setError,
    onSaved: actions.onClose,
  });
  const submit = methods.handleSubmit(rename.save);
  return (
    <form
      noValidate
      onSubmit={(event) => {
        void submit(event);
      }}
      className="flex flex-col gap-4.5"
    >
      <FormServerError control={methods.control} />
      <VersionTitleField methods={methods} autoFocus />
      <DialogFooter className="justify-end">
        <DialogClose asChild>
          <Button variant="outline">{COPY.cancel}</Button>
        </DialogClose>
        <Button type="submit" loading={rename.isPending}>
          {COPY.save}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function RenameVersionDialog({ version, actions, handlers }: RenameVersionDialogProps) {
  const shown = useLastPresent(version);
  return (
    <Dialog
      open={version !== null}
      onOpenChange={(open) => {
        if (!open) actions.onClose();
      }}
    >
      {shown && (
        <DialogContent header={{ title: COPY.title }} handlers={{ ...handlers }}>
          <RenameForm key={shown.id} version={shown} actions={actions} />
        </DialogContent>
      )}
    </Dialog>
  );
}
