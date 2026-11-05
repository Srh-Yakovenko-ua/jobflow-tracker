'use client';

import { Dialog as DialogPrimitive } from 'radix-ui';
import {
  createContext,
  type ReactNode,
  use,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';

import { DialogOverlay } from './dialog';

export type SheetProps = Readonly<{ title: string; onClose: () => void; children: ReactNode }>;

export const OWNS_ESCAPE = { 'data-owns-escape': '' } as const;

export const SheetClose = DialogPrimitive.Close;

const SheetCloseContext = createContext<(() => void) | null>(null);

export function useSheetClose(): (() => void) | null {
  return use(SheetCloseContext);
}

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

function useCloseAfterExit(onClose: () => void) {
  const [open, setOpen] = useState(true);
  const closingRef = useRef(false);
  return {
    open,
    close: () => {
      closingRef.current = true;
      setOpen(false);
    },
    onExited: () => {
      if (closingRef.current) onClose();
    },
  };
}

function OnUnmount({ run }: Readonly<{ run: () => void }>) {
  const onUnmount = useEffectEvent(run);
  useEffect(
    () => () => {
      onUnmount();
    },
    [],
  );
  return null;
}

export function Sheet({ title, onClose, children }: SheetProps) {
  const openerFocus = useOpenerFocus();
  const closing = useCloseAfterExit(onClose);
  return (
    <DialogPrimitive.Root
      open={closing.open}
      onOpenChange={(open) => {
        if (!open) closing.close();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogOverlay />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onEscapeKeyDown={leaveEscapeToItsOwner}
          {...openerFocus}
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-180 animate-sheet-in flex-col overflow-y-auto bg-paper p-4 font-ui text-ink shadow-e3 data-[state=closed]:animate-sheet-out md:p-6.5"
        >
          <OnUnmount run={closing.onExited} />
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          <SheetCloseContext value={closing.close}>{children}</SheetCloseContext>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
