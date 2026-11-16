'use client';

import { Printer } from 'lucide-react';

import { Button } from './button';

export type PrintButtonProps = Readonly<{ label: string }>;

export function PrintButton({ label }: PrintButtonProps) {
  return (
    <Button
      icon={<Printer aria-hidden size={16} strokeWidth={1.9} />}
      onClick={() => {
        window.print();
      }}
    >
      {label}
    </Button>
  );
}
