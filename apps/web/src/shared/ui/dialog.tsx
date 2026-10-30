'use client';

import { X } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import type { KeyboardEvent, ReactNode } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import { ICON_ACTION } from './field-surface';

export const Dialog = DialogPrimitive.Root;

export const DialogTrigger = DialogPrimitive.Trigger;

export const DialogClose = DialogPrimitive.Close;

export type DialogHeader = { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode };

export type DialogContentHandlers = Readonly<{
  onOpenAutoFocus?: (event: Event) => void;
  onCloseAutoFocus?: (event: Event) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
}>;

export type DialogContentProps = Readonly<{
  header: DialogHeader;
  children?: ReactNode;
  className?: string | undefined;
  handlers?: DialogContentHandlers;
}>;

export type DialogFooterProps = Readonly<{ children: ReactNode; className?: string }>;

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

export function keepFocusOnDialog(event: Event) {
  event.preventDefault();
  if (event.target instanceof HTMLElement) event.target.focus();
}

export function DialogFooter({ children, className }: DialogFooterProps) {
  return (
    <div
      className={cn(
        '-mx-6 -mb-6 flex flex-wrap items-center justify-between gap-4 bg-surface-2 px-6 pt-3.75 pb-4.5',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DialogOverlay() {
  return (
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim/34 backdrop-blur-[2px] transition-opacity duration-(--duration-base) ease-standard starting:opacity-0" />
  );
}

export function DialogContent({ header, children, className, handlers }: DialogContentProps) {
  const describedBy = header.description ? {} : { 'aria-describedby': undefined };
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        {...describedBy}
        {...handlers}
        className={cn(
          'fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-130 -translate-1/2 animate-spring-in flex-col gap-4.5 overflow-y-auto rounded-3xl bg-surface p-6 font-ui text-ink shadow-e3',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <DialogHead header={header} />
          <DialogPrimitive.Close
            aria-label={uk.app.close}
            className={cn(ICON_ACTION, 'size-8 rounded-[10px] bg-surface-2')}
          >
            <X aria-hidden />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
