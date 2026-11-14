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
  const main = <div className={MAIN}>{slots.main}</div>;
  const side = <div className={SIDE}>{slots.side}</div>;
  if (!wide) {
    return (
      <div className={cn(MAIN, 'pt-8')}>
        {slots.header}
        {slots.followup}
        {main}
        {side}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[minmax(0,1.55fr)_minmax(280px,1fr)] items-start gap-10 pt-8">
      <div className={MAIN}>
        {slots.header}
        {main}
      </div>
      <div className={SIDE}>
        {slots.followup}
        {side}
      </div>
    </div>
  );
}
