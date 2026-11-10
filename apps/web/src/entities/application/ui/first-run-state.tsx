'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { buttonLinkClasses } from '@/shared/ui/button';
import { DashedBars, EmptyState } from '@/shared/ui/empty-state';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

const COPY = uk.board.firstRun;

const INSTALL_HREF = '/settings#aiPrivacy';

function InstallLink() {
  return (
    <Link
      href={INSTALL_HREF}
      className={cn(buttonLinkClasses({ variant: 'secondary', size: 'lg' }), TOUCH_HEIGHT)}
    >
      {COPY.bookmarklet}
    </Link>
  );
}

export type FirstRunStateProps = Readonly<{ action?: ReactNode }>;

export function FirstRunState({ action }: FirstRunStateProps) {
  return (
    <EmptyState
      content={COPY}
      view={{ size: 'page' }}
      slots={{ figure: <DashedBars />, action: action ?? <InstallLink /> }}
    />
  );
}
