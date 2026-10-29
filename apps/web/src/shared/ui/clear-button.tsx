import { X } from 'lucide-react';
import type { KeyboardEvent } from 'react';

import { cn } from '@/shared/lib/cn';

import { ICON_ACTION } from './field-surface';

export type ClearButtonProps = Readonly<{
  label: string;
  onClear: () => void;
  className?: string | undefined;
}>;

function keepEnterOnButton(event: KeyboardEvent<HTMLButtonElement>) {
  if (event.key === 'Enter') event.stopPropagation();
}

export function ClearButton({ label, onClear, className }: ClearButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClear}
      onKeyDown={keepEnterOnButton}
      className={cn(ICON_ACTION, 'z-10 size-6', className)}
    >
      <X aria-hidden size={14} />
    </button>
  );
}
