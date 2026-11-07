'use client';

import { Button } from './button';
import { DialogClose, DialogFooter } from './dialog';

export type ConfirmFooterProps = Readonly<{
  copy: Readonly<{ cancel: string; confirm: string }>;
  action: Readonly<{ pending: boolean; onConfirm: () => void }>;
}>;

export function ConfirmFooter({ copy, action }: ConfirmFooterProps) {
  return (
    <DialogFooter className="justify-end">
      <DialogClose asChild>
        <Button variant="outline">{copy.cancel}</Button>
      </DialogClose>
      <Button
        variant="danger"
        loading={action.pending}
        onClick={() => {
          action.onConfirm();
        }}
      >
        {copy.confirm}
      </Button>
    </DialogFooter>
  );
}
