'use client';

import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';
import { useMediaQuery } from '@/shared/lib/use-media-query';

import type { ApplicationPageMode } from './page-top-bar';

export const WIDE_PAGE_QUERY = '(width >= 75rem)';

export type PageSlots = Readonly<{
  header: ReactNode;
  followup: ReactNode;
  main: ReactNode;
  side: ReactNode;
}>;

export type PageColumnsProps = Readonly<{
  slots: PageSlots;
  view: Readonly<{ mode: ApplicationPageMode }>;
}>;

const MAIN = 'flex min-w-0 flex-col gap-10';

const SIDE = 'flex min-w-0 flex-col gap-6';

export function PageColumns({ slots, view }: PageColumnsProps) {
  const wide = useMediaQuery(WIDE_PAGE_QUERY) && view.mode === 'page';
  return (
    <div
      className={cn(
        'pt-8',
        wide ? 'grid grid-cols-[minmax(0,1.55fr)_minmax(280px,1fr)] items-start gap-10' : MAIN,
      )}
    >
      <div className={MAIN}>
        {slots.header}
        {!wide && slots.followup}
        <div className={MAIN}>{slots.main}</div>
      </div>
      <div className={SIDE}>
        {wide && slots.followup}
        <div className={SIDE}>{slots.side}</div>
      </div>
    </div>
  );
}
