import { X } from 'lucide-react';

import { cn } from '@/shared/lib/cn';

export type ClearButtonProps = Readonly<{
  label: string;
  onClear: () => void;
  className?: string | undefined;
}>;

export function ClearButton({ label, onClear, className }: ClearButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClear}
      className={cn(
        'touch-target z-10 flex size-6 flex-none items-center justify-center rounded-sm text-ink-3 transition-colors duration-(--duration-instant) ease-standard hover:bg-surface-3 hover:text-ink',
        className,
      )}
    >
      <X aria-hidden size={14} />
    </button>
  );
}
