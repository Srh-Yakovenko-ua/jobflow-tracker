import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

export type KbdProps = Readonly<{ children: ReactNode; className?: string | undefined }>;

export function Kbd({ children, className }: KbdProps) {
  return (
    <kbd
      className={cn(
        'inline-flex min-w-5 items-center justify-center rounded-xs bg-surface px-1.25 py-0.5 font-ui text-[10px] leading-none font-bold tracking-[0.06em] text-ink-2 inset-ring inset-ring-line',
        className,
      )}
    >
      {children}
    </kbd>
  );
}
