'use client';

import type { ApplicationResponse } from '@jobflow/shared';

import { uk } from '@/shared/i18n';
import { useLastPresent } from '@/shared/lib/use-last-present';
import { ConfirmFooter } from '@/shared/ui/confirm-footer';
import { Dialog, DialogContent, type DialogContentHandlers } from '@/shared/ui/dialog';

import { useDeleteApplicationMutation } from '../model/use-delete-application-mutation';

export type DeleteApplicationActions = Readonly<{ onCancel: () => void; onDeleted: () => void }>;

export type DeleteApplicationDialogProps = Readonly<{
  application: ApplicationResponse | null;
  actions: DeleteApplicationActions;
  handlers?: Pick<DialogContentHandlers, 'onOpenAutoFocus' | 'onCloseAutoFocus'>;
}>;

const COPY = uk.applicationPage.deletion;

export function DeleteApplicationDialog({
  application,
  actions,
  handlers,
}: DeleteApplicationDialogProps) {
  const mutation = useDeleteApplicationMutation();
  const shown = useLastPresent(application);
  return (
    <Dialog
      open={application !== null && !mutation.isSuccess}
      onOpenChange={(open) => {
        if (!open) actions.onCancel();
      }}
    >
      {shown && (
        <DialogContent
          header={{ title: COPY.title, description: COPY.body(shown.position) }}
          handlers={{ ...handlers }}
        >
          <ConfirmFooter
            copy={COPY}
            action={{
              pending: mutation.isPending,
              onConfirm: () => {
                if (application === null) return;
                mutation.mutate(application.id, { onSuccess: actions.onDeleted });
              },
            }}
          />
        </DialogContent>
      )}
    </Dialog>
  );
}
