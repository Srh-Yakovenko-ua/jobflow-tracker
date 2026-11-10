'use client';

import { useState } from 'react';

import { Button, type ButtonVariant } from './button';
import { ConfirmFooter, type ConfirmFooterProps } from './confirm-footer';
import { Dialog, DialogContent, DialogTrigger } from './dialog';
import { TOUCH_HEIGHT } from './touch-height';

export type ConfirmAction = Readonly<{
  pending: boolean;
  onConfirm: (close: () => void) => void;
}>;

export type ConfirmDialogProps = Readonly<{
  trigger: Readonly<{ label: string; variant: ButtonVariant }>;
  copy: ConfirmFooterProps['copy'] & Readonly<{ title: string; body: string }>;
  action: ConfirmAction;
}>;

export function ConfirmDialog({ trigger, copy, action }: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const close = () => {
    setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={trigger.variant} className={TOUCH_HEIGHT}>
          {trigger.label}
        </Button>
      </DialogTrigger>
      <DialogContent header={{ title: copy.title, description: copy.body }}>
        <ConfirmFooter
          copy={copy}
          action={{
            pending: action.pending,
            onConfirm: () => {
              action.onConfirm(close);
            },
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
