'use client';

import { uk } from '@/shared/i18n';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';

import { useDeleteAiResultsMutation } from '../model/use-delete-ai-results-mutation';

const COPY = uk.settings.aiPrivacy.dataDeletion;

const TRIGGER = { label: COPY.action, variant: 'danger' } as const;

export function DeleteAiResultsDialog() {
  const mutation = useDeleteAiResultsMutation();
  return (
    <ConfirmDialog
      trigger={TRIGGER}
      copy={COPY.dialog}
      action={{
        pending: mutation.isPending,
        onConfirm: (close) => {
          mutation.mutate(undefined, { onSuccess: close });
        },
      }}
    />
  );
}
