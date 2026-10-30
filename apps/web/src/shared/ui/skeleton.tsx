'use client';

import type { ComponentType } from 'react';

import { cn } from '@/shared/lib/cn';

import { SHIMMER } from './shimmer';
import { type SkeletonMotion, useSkeletonMotion } from './skeleton-motion';

const FILL: Record<SkeletonMotion, string> = { shimmer: SHIMMER, static: 'bg-surface-3' };

const BAR = 'block rounded-[7px]';

const RAISED = 'bg-surface shadow-e1';

const PLOT_BARS = ['first', 'second', 'third', 'fourth', 'fifth'] as const;

const TEXT_LINES = ['w-[96%]', 'w-[88%]', 'w-[72%]'] as const;

type BarProps = Readonly<{ motion: SkeletonMotion; className: string }>;

function Bar({ motion, className }: BarProps) {
  return <span className={cn(BAR, FILL[motion], className)} />;
}

type CardBarsProps = Readonly<{ motion: SkeletonMotion }>;

function FullCardBars({ motion }: CardBarsProps) {
  return (
    <>
      <Bar motion={motion} className="h-3.25 w-[78%]" />
      <Bar motion={motion} className="h-2.5 w-[52%]" />
      <span className="h-px bg-line-soft" />
      <Bar motion="static" className="h-2.25 w-[40%]" />
    </>
  );
}

function CompactCardBars({ motion }: CardBarsProps) {
  return (
    <>
      <Bar motion={motion} className="h-3.25 w-[62%]" />
      <Bar motion="static" className="h-2.5 w-[44%]" />
    </>
  );
}

export type CardSkeletonDensity = 'full' | 'compact';

const CARD_BARS: Record<CardSkeletonDensity, ComponentType<CardBarsProps>> = {
  full: FullCardBars,
  compact: CompactCardBars,
};

export type CardSkeletonProps = Readonly<{ view?: { density?: CardSkeletonDensity } }>;

export function CardSkeleton({ view }: CardSkeletonProps) {
  const motion = useSkeletonMotion();
  const Bars = CARD_BARS[view?.density ?? 'full'];
  return (
    <div aria-hidden className={cn('flex flex-col gap-2.25 rounded-lg p-3', RAISED)}>
      <Bars motion={motion} />
    </div>
  );
}

export function ColumnSkeleton() {
  return (
    <div
      aria-hidden
      className="flex flex-col gap-2.5 rounded-lg bg-surface-3 p-2.5 inset-ring inset-ring-line-soft"
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn(BAR, 'h-2.25 w-16 bg-line-soft')} />
        <span className={cn(BAR, 'h-2.25 w-4 bg-line-soft')} />
      </div>
      <CardSkeleton />
      <CardSkeleton view={{ density: 'compact' }} />
    </div>
  );
}

export function ChartSkeleton() {
  const motion = useSkeletonMotion();
  return (
    <div aria-hidden className={cn('flex flex-col gap-4 p-5', RAISED)}>
      <Bar motion="static" className="h-2.25 w-23" />
      <Bar motion={motion} className="h-10 w-27" />
      <div className="flex h-21 items-end gap-1.5">
        {PLOT_BARS.map((bar) => (
          <span key={bar} className="h-[52%] flex-1 bg-surface-3" />
        ))}
      </div>
    </div>
  );
}

export function TextSkeleton() {
  const motion = useSkeletonMotion();
  return (
    <div aria-hidden className="flex flex-col gap-2">
      {TEXT_LINES.map((width) => (
        <Bar key={width} motion={motion} className={cn('h-2.75', width)} />
      ))}
    </div>
  );
}
