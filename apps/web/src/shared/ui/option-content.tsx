import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

import type { SelectOption } from './field-surface';

export type OptionContentProps = Readonly<{ option: SelectOption; label: ReactNode }>;

export type CheckSlotProps = Readonly<{ checked: boolean }>;

const CAPTION =
  'caption font-normal text-ink-3 dark:in-data-highlighted:text-ink-2 dark:in-data-[selected=true]:text-ink-2';

export function CheckSlot({ checked }: CheckSlotProps) {
  return (
    <span aria-hidden className="flex w-3.75 flex-none justify-center text-accent-press">
      {checked && <Check size={14} />}
    </span>
  );
}

export function OptionContent({ option, label }: OptionContentProps) {
  return (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="truncate">{label}</span>
        {option.detail && <span className={CAPTION}>{option.detail}</span>}
      </span>
      {option.meta && <span className={cn(CAPTION, 'flex-none tabular-nums')}>{option.meta}</span>}
    </>
  );
}
