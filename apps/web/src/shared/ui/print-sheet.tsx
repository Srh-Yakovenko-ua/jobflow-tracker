'use client';

import type { ReactNode } from 'react';

import { LightScheme } from '@/shared/lib/theme';

const SHEET =
  'mx-auto flex w-full max-w-[210mm] min-w-0 flex-col gap-6 rounded-xl p-8 shadow-e2 max-sm:p-4 print:max-w-none print:rounded-none print:p-0 print:bg-transparent print:shadow-none print:[print-color-adjust:exact]';

export type PrintSheetProps = Readonly<{ children: ReactNode }>;

export function PrintSheet({ children }: PrintSheetProps) {
  return <LightScheme className={SHEET}>{children}</LightScheme>;
}
