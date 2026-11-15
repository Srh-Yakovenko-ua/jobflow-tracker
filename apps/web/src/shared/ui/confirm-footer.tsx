'use client';

import { cn } from '@/shared/lib/cn';

import { Button } from './button';
import { DialogClose, DialogFooter } from './dialog';
import { TOUCH_HEIGHT } from './touch-height';

const DARK_FOOTER_DANGER =
  'dark:bg-transparent dark:not-disabled:hover:bg-surface-3 dark:not-disabled:active:bg-surface-3';

export type ConfirmFooterProps = Readonly<{
  copy: Readonly<{ cancel: string; confirm: string }>;
  action: Readonly<{ pending: boolean; onConfirm: () => void }>;
}>;

export function ConfirmFooter({ copy, action }: ConfirmFooterProps) {
  return (
    <DialogFooter className="justify-end">
      <DialogClose asChild>
        <Button variant="outline" className={TOUCH_HEIGHT}>
          {copy.cancel}
        </Button>
      </DialogClose>
      <Button
        variant="danger"
        className={cn(TOUCH_HEIGHT, DARK_FOOTER_DANGER)}
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
