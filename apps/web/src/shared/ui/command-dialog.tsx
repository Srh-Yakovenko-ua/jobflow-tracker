'use client';

import { Dialog as DialogPrimitive } from 'radix-ui';
import type { ReactNode } from 'react';

import { type DialogContentHandlers, DialogOverlay, type DialogState } from './dialog';

export type CommandDialogHandlers = Pick<DialogContentHandlers, 'onCloseAutoFocus'> &
  Readonly<{ onEscapeKeyDown?: (event: KeyboardEvent) => void }>;

export type CommandDialogProps = Readonly<{
  state: DialogState;
  title: string;
  handlers?: CommandDialogHandlers;
  children: ReactNode;
}>;

export function CommandDialog({ state, title, handlers, children }: CommandDialogProps) {
  return (
    <DialogPrimitive.Root open={state.open} onOpenChange={state.onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogOverlay />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          {...handlers}
          className="fixed top-4 left-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-140 -translate-x-1/2 animate-spring-in flex-col overflow-hidden rounded-2xl bg-surface font-ui text-ink shadow-e3 data-[state=closed]:animate-spring-out sm:top-[12dvh] sm:max-h-[76dvh]"
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
