'use client';

import type { insufficientDataSchema } from '@jobflow/shared';
import { AnimatePresence } from 'motion/react';
import { type ReactNode, useId } from 'react';
import type { z } from 'zod';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import { DashedBars, EmptyState } from './empty-state';
import { LoadFailedPanel } from './error-panel';
import { Fade } from './fade';
import { LoadingRegion } from './loading-region';
import { ChartPlotSkeleton } from './skeleton';
import { useSkeletonMotion } from './skeleton-motion';

const COPY = uk.states.empty;

const PLOT_HEIGHT = 'h-55';

const HERO_PLOT_HEIGHT = 'h-95';

export type ChartFrameState =
  | { status: 'loading' }
  | { status: 'failed'; onRetry: () => void; retrying?: boolean | undefined }
  | z.infer<typeof insufficientDataSchema>
  | { status: 'ready' };

export type ChartFrameHeader = { eyebrow: string; title?: string; body?: string };

export type ChartFramePlot = 'boxed' | 'hero' | 'open';

export type ChartFrameView = Readonly<{
  plot?: Exclude<ChartFramePlot, 'boxed'>;
  actions?: ReactNode;
}>;

const PLOTS: Record<ChartFramePlot, { skeleton: string; boxed: boolean }> = {
  boxed: { skeleton: PLOT_HEIGHT, boxed: true },
  hero: { skeleton: HERO_PLOT_HEIGHT, boxed: false },
  open: { skeleton: PLOT_HEIGHT, boxed: false },
};

export type ChartFrameProps = Readonly<{
  header: ChartFrameHeader;
  state: ChartFrameState;
  children?: ReactNode;
  view?: ChartFrameView;
}>;

type PlotSkeletonProps = Readonly<{ height: string }>;

function PlotSkeleton({ height }: PlotSkeletonProps) {
  const motion = useSkeletonMotion();
  return (
    <LoadingRegion>
      <ChartPlotSkeleton motion={motion} className={height} />
    </LoadingRegion>
  );
}

type FrameBodyProps = Readonly<{
  state: ChartFrameState;
  plot: ChartFramePlot;
  children: ReactNode;
}>;

function FrameBody({ state, plot, children }: FrameBodyProps) {
  const look = PLOTS[plot];
  switch (state.status) {
    case 'loading':
      return <PlotSkeleton height={look.skeleton} />;
    case 'failed':
      return <LoadFailedPanel onRetry={state.onRetry} retrying={state.retrying} />;
    case 'insufficient_data':
      return (
        <EmptyState
          content={{ title: COPY.lowData, hint: state.message }}
          progress={{ count: state.have, goal: state.need }}
          slots={{ figure: <DashedBars view={{ density: 'compact' }} /> }}
          view={{ size: 'compact' }}
        />
      );
    case 'ready':
      return look.boxed ? (
        <div className={cn('relative min-w-0', PLOT_HEIGHT)}>{children}</div>
      ) : (
        children
      );
    default: {
      const unhandled: never = state;
      throw new Error(`unknown chart state ${JSON.stringify(unhandled)}`);
    }
  }
}

type FrameHeadingProps = Readonly<{ header: ChartFrameHeader; labelId: string }>;

function FrameHeading({ header, labelId }: FrameHeadingProps) {
  const { eyebrow, title, body } = header;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span id={title ? undefined : labelId} className="eyebrow text-ink-3">
        {eyebrow}
      </span>
      {title && (
        <h2
          id={labelId}
          className="font-display text-[19px] leading-[normal] font-medium tracking-[-0.03em] text-ink"
        >
          {title}
        </h2>
      )}
      {body && <p className="text-[13px] leading-[1.55] text-pretty text-ink-2">{body}</p>}
    </div>
  );
}

export function ChartFrame({ header, state, children, view = {} }: ChartFrameProps) {
  const labelId = useId();
  return (
    <section
      aria-labelledby={labelId}
      className="flex min-w-0 flex-col gap-3 rounded-xl bg-surface p-4.5 shadow-e1"
    >
      {view.actions === undefined ? (
        <FrameHeading header={header} labelId={labelId} />
      ) : (
        <div className="flex flex-wrap items-end justify-between gap-4.5">
          <FrameHeading header={header} labelId={labelId} />
          {view.actions}
        </div>
      )}
      <AnimatePresence mode="popLayout" initial={false}>
        <Fade key={state.status}>
          <FrameBody state={state} plot={view.plot ?? 'boxed'}>
            {children}
          </FrameBody>
        </Fade>
      </AnimatePresence>
    </section>
  );
}
