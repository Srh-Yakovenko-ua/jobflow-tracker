'use client';

import type { ReactNode, RefObject } from 'react';

import { LoadFailedPanel } from '@/shared/ui/error-panel';
import { PageSkeleton } from '@/shared/ui/skeleton';

import type { SectionLoad } from '../model/use-reminders-page';

const SECTION_TITLE = 'font-display text-[20px] leading-[1.2] text-ink';

export type SectionFrameProps = Readonly<{
  title: string;
  titleRef?: RefObject<HTMLHeadingElement | null>;
  children: ReactNode;
}>;

export type SectionBodyProps = Readonly<{ load: SectionLoad; ready: boolean; children: ReactNode }>;

export function SectionFrame({ title, titleRef, children }: SectionFrameProps) {
  return (
    <section className="flex min-w-0 flex-col gap-3.5">
      <h2 ref={titleRef} tabIndex={-1} className={SECTION_TITLE}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function SectionBody({ load, ready, children }: SectionBodyProps) {
  if (ready) return children;
  if (!load.failed) return <PageSkeleton />;
  return <LoadFailedPanel onRetry={load.onRetry} retrying={load.retrying} />;
}
