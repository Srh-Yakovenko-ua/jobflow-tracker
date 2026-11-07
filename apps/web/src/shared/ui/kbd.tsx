import type { ReactNode } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

export type KbdProps = Readonly<{ children: ReactNode; className?: string | undefined }>;

export type KeyHintProps = Readonly<{ keys: string; children: ReactNode }>;

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

export function KeyHint({ keys, children }: KeyHintProps) {
  return (
    <span className="flex items-center gap-1.5">
      <Kbd>{keys}</Kbd>
      {children}
    </span>
  );
}

export function ListKeyHints() {
  return (
    <>
      <KeyHint keys={uk.ui.keys.navigate}>{uk.ui.navigate}</KeyHint>
      <KeyHint keys={uk.ui.keys.select}>{uk.ui.select}</KeyHint>
    </>
  );
}
