'use client';

import { cn } from '@/shared/lib/cn';

import { Button } from './button';
import { DialogClose, DialogFooter } from './dialog';
import { TOUCH_HEIGHT } from './touch-height';

const DARK_FOOTER_DANGER =
  'dark:bg-transparent dark:not-disabled:hover:bg-surface-3 dark:not-disabled:active:bg-surface-3';

export type ConfirmTone = 'danger' | 'primary';

const CONFIRM_LOOKS: Readonly<Record<ConfirmTone, string>> = {
  danger: DARK_FOOTER_DANGER,
  primary: '',
};

export type ConfirmFooterProps = Readonly<{
  copy: Readonly<{ cancel: string; confirm: string }>;
  action: Readonly<{ pending: boolean; onConfirm: () => void; tone?: ConfirmTone }>;
}>;

export function ConfirmFooter({ copy, action }: ConfirmFooterProps) {
  const tone = action.tone ?? 'danger';
  return (
    <DialogFooter className="justify-end">
      <DialogClose asChild>
        <Button variant="outline" className={TOUCH_HEIGHT}>
          {copy.cancel}
        </Button>
      </DialogClose>
      <Button
        variant={tone}
        className={cn(TOUCH_HEIGHT, CONFIRM_LOOKS[tone])}
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
