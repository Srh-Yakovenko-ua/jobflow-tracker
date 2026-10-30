import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

export type EditTriggerProps = Readonly<{
  onEdit: () => void;
  children: ReactNode;
  className?: string;
}>;

const TRIGGER =
  'touch-target -mx-1 cursor-text rounded-sm px-1 text-start transition-colors duration-(--duration-fast) ease-standard hover:bg-surface-3';

export function EditTrigger({ onEdit, children, className }: EditTriggerProps) {
  return (
    <button type="button" tabIndex={-1} onClick={onEdit} className={cn(TRIGGER, className)}>
      {children}
    </button>
  );
}
