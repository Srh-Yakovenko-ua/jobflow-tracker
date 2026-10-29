'use client';

import { X } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import type { ReactNode } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import { ICON_ACTION } from './field-surface';

export const Dialog = DialogPrimitive.Root;

export const DialogTrigger = DialogPrimitive.Trigger;

export const DialogClose = DialogPrimitive.Close;

export type DialogHeader = { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode };

export type DialogContentProps = Readonly<{
  header: DialogHeader;
  children?: ReactNode;
  className?: string | undefined;
}>;

function DialogHead({ header }: Readonly<{ header: DialogHeader }>) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {header.eyebrow && (
        <p className="text-[11px] leading-[1.3] font-semibold tracking-[0.12em] text-ink-3 uppercase">
          {header.eyebrow}
        </p>
      )}
      <DialogPrimitive.Title className="font-display text-[24px] leading-[1.16] font-medium tracking-[-0.032em]">
        {header.title}
      </DialogPrimitive.Title>
      {header.description && (
        <DialogPrimitive.Description className="text-[13.5px] leading-[1.55] text-ink-2">
          {header.description}
        </DialogPrimitive.Description>
      )}
    </div>
  );
}

export function DialogContent({ header, children, className }: DialogContentProps) {
  const describedBy = header.description ? {} : { 'aria-describedby': undefined };
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim/34 backdrop-blur-[2px] transition-opacity duration-(--duration-base) ease-standard starting:opacity-0" />
      <DialogPrimitive.Content
        {...describedBy}
        className={cn(
          'fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-130 -translate-1/2 animate-spring-in flex-col gap-4.5 overflow-y-auto rounded-3xl bg-surface p-6 font-ui text-ink shadow-e3',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <DialogHead header={header} />
          <DialogPrimitive.Close aria-label={uk.app.close} className={cn(ICON_ACTION, 'size-7')}>
            <X aria-hidden />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
