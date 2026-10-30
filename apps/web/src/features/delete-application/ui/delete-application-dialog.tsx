'use client';

import type { ApplicationResponse } from '@jobflow/shared';

import { uk } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  type DialogContentHandlers,
  DialogFooter,
} from '@/shared/ui/dialog';

import { useDeleteApplicationMutation } from '../model/use-delete-application-mutation';

export type DeleteApplicationActions = Readonly<{ onCancel: () => void; onDeleted: () => void }>;

export type DeleteApplicationDialogProps = Readonly<{
  application: ApplicationResponse | null;
  actions: DeleteApplicationActions;
  handlers?: Pick<DialogContentHandlers, 'onCloseAutoFocus'>;
}>;

const COPY = uk.applicationPage.deletion;

export function DeleteApplicationDialog({
  application,
  actions,
  handlers,
}: DeleteApplicationDialogProps) {
  const mutation = useDeleteApplicationMutation();
  return (
    <Dialog
      open={application !== null}
      onOpenChange={(open) => {
        if (!open) actions.onCancel();
      }}
    >
      {application && (
        <DialogContent
          header={{ title: COPY.title, description: COPY.body(application.position) }}
          handlers={{ ...handlers }}
        >
          <DialogFooter className="justify-end">
            <DialogClose asChild>
              <Button variant="outline">{COPY.cancel}</Button>
            </DialogClose>
            <Button
              variant="danger"
              loading={mutation.isPending}
              onClick={() => {
                mutation.mutate(application.id, { onSuccess: actions.onDeleted });
              }}
            >
              {COPY.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
