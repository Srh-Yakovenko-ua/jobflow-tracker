'use client';

import { useState } from 'react';

import { uk } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';
import { ConfirmFooter } from '@/shared/ui/confirm-footer';
import { Dialog, DialogContent, DialogTrigger } from '@/shared/ui/dialog';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import { useDeleteAiResultsMutation } from '../model/use-delete-ai-results-mutation';

const COPY = uk.settings.aiPrivacy.dataDeletion;

export function DeleteAiResultsDialog() {
  const mutation = useDeleteAiResultsMutation();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="danger" className={TOUCH_HEIGHT}>
          {COPY.action}
        </Button>
      </DialogTrigger>
      <DialogContent header={{ title: COPY.dialog.title, description: COPY.dialog.body }}>
        <ConfirmFooter
          copy={COPY.dialog}
          action={{
            pending: mutation.isPending,
            onConfirm: () => {
              mutation.mutate(undefined, {
                onSuccess: () => {
                  setOpen(false);
                },
              });
            },
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
