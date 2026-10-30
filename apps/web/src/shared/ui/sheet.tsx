'use client';

import { Dialog as DialogPrimitive } from 'radix-ui';
import { type ReactNode, useRef } from 'react';

import { DialogOverlay } from './dialog';

export type SheetProps = Readonly<{ title: string; onClose: () => void; children: ReactNode }>;

export const OWNS_ESCAPE = { 'data-owns-escape': '' } as const;

function leaveEscapeToItsOwner(event: KeyboardEvent) {
  if (event.target instanceof Element && event.target.closest('[data-owns-escape]')) {
    event.preventDefault();
  }
}

function useOpenerFocus() {
  const openerRef = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: () => {
      openerRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
    },
    onCloseAutoFocus: (event: Event) => {
      event.preventDefault();
      openerRef.current?.focus();
    },
  };
}

export function Sheet({ title, onClose, children }: SheetProps) {
  const openerFocus = useOpenerFocus();
  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogOverlay />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onEscapeKeyDown={leaveEscapeToItsOwner}
          {...openerFocus}
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-180 animate-sheet-in flex-col overflow-y-auto bg-paper p-4 font-ui text-ink shadow-e3 md:p-6.5"
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
