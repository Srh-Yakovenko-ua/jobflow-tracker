'use client';

import { Printer } from 'lucide-react';
import Link from 'next/link';

import { OFFER_COMPARE } from '@/entities/application';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { buttonLinkClasses } from '@/shared/ui/button';
import { PrintButton } from '@/shared/ui/print-button';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import type { ComparisonMode } from '../model/comparison-mode';

const COPY = uk.offerCompare.toolbar;

const LINK = cn(buttonLinkClasses({ variant: 'secondary', size: 'md' }), TOUCH_HEIGHT);

export type ComparisonToolbarProps = Readonly<{ mode: ComparisonMode }>;

export function ComparisonToolbar({ mode }: ComparisonToolbarProps) {
  if (mode === 'screen') {
    return (
      <Link href={OFFER_COMPARE.printHref} className={cn(LINK, 'print:hidden')}>
        <Printer aria-hidden size={16} strokeWidth={1.9} />
        {COPY.toPrint}
      </Link>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
      <Link href={OFFER_COMPARE.href} className={LINK}>
        {COPY.back}
      </Link>
      <PrintButton label={COPY.print} />
    </div>
  );
}
