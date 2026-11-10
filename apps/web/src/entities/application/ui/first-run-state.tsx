'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { buttonLinkClasses } from '@/shared/ui/button';
import { DashedBars, EmptyState } from '@/shared/ui/empty-state';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

const COPY = uk.board.firstRun;

const LINKS = [
  { id: 'addFirst', href: '/add', variant: 'primary' },
  { id: 'bookmarklet', href: '/settings#aiPrivacy', variant: 'secondary' },
] as const;

function FirstRunLinks() {
  return LINKS.map((link) => (
    <Link
      key={link.id}
      href={link.href}
      className={cn(buttonLinkClasses({ variant: link.variant, size: 'lg' }), TOUCH_HEIGHT)}
    >
      {COPY[link.id]}
    </Link>
  ));
}

export type FirstRunStateProps = Readonly<{ action?: ReactNode }>;

export function FirstRunState({ action }: FirstRunStateProps) {
  return (
    <EmptyState
      content={COPY}
      view={{ size: 'page' }}
      slots={{ figure: <DashedBars />, action: action ?? <FirstRunLinks /> }}
    />
  );
}
