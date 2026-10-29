import { X } from 'lucide-react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

const TONES = {
  accent: {
    chip: 'bg-accent-tint font-medium text-accent-ink inset-ring-accent/20',
    remove: 'size-4.25 after:right-[-6.5px] hover:bg-accent/15',
  },
  neutral: {
    chip: 'bg-surface inset-ring-line',
    remove: 'size-4 text-ink-3 after:right-[-7px] hover:bg-danger/8 hover:text-danger',
  },
} as const;

export type ChipTone = keyof typeof TONES;

export type ChipProps = Readonly<{ label: string; tone: ChipTone; onRemove: () => void }>;

export function Chip({ label, tone, onRemove }: ChipProps) {
  return (
    <span
      className={cn(
        'relative z-10 flex items-center gap-1.25 rounded-[7px] py-0.75 pr-1 pl-2 text-[12px] text-ink inset-ring',
        TONES[tone].chip,
      )}
    >
      {label}
      <button
        type="button"
        aria-label={`${uk.ui.remove} ${label}`}
        onClick={onRemove}
        className={cn(
          'touch-target flex flex-none items-center justify-center rounded-xs transition-colors duration-(--duration-instant) ease-standard after:left-auto after:[transform:translateY(-50%)]',
          TONES[tone].remove,
        )}
      >
        <X aria-hidden size={12} />
      </button>
    </span>
  );
}
