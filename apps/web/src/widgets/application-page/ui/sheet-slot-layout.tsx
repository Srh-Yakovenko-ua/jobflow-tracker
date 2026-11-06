import type { ReactNode } from 'react';

export type SheetSlotLayoutProps = Readonly<{ children: ReactNode; sheet: ReactNode }>;

export function SheetSlotLayout({ children, sheet }: SheetSlotLayoutProps) {
  return (
    <>
      {children}
      {sheet}
    </>
  );
}
