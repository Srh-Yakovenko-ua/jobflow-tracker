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

export type ChartFrameState =
  | { status: 'loading' }
  | { status: 'failed'; onRetry: () => void; retrying?: boolean | undefined }
  | z.infer<typeof insufficientDataSchema>
  | { status: 'ready' };

export type ChartFrameHeader = { eyebrow: string; title?: string };

export type ChartFrameProps = Readonly<{
  header: ChartFrameHeader;
  state: ChartFrameState;
  children?: ReactNode;
}>;

function PlotSkeleton() {
  const motion = useSkeletonMotion();
  return (
    <LoadingRegion>
      <ChartPlotSkeleton motion={motion} className={PLOT_HEIGHT} />
    </LoadingRegion>
  );
}

type FrameBodyProps = Readonly<{ state: ChartFrameState; children: ReactNode }>;

function FrameBody({ state, children }: FrameBodyProps) {
  switch (state.status) {
    case 'loading':
      return <PlotSkeleton />;
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
      return <div className={cn('relative min-w-0', PLOT_HEIGHT)}>{children}</div>;
    default: {
      const unhandled: never = state;
      throw new Error(`unknown chart state ${JSON.stringify(unhandled)}`);
    }
  }
}

export function ChartFrame({ header, state, children }: ChartFrameProps) {
  const labelId = useId();
  const { eyebrow, title } = header;
  return (
    <section
      aria-labelledby={labelId}
      className="flex min-w-0 flex-col gap-3 rounded-xl bg-surface p-4.5 shadow-e1"
    >
      <div className="flex flex-col gap-1">
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
      </div>
      <AnimatePresence mode="popLayout" initial={false}>
        <Fade key={state.status}>
          <FrameBody state={state}>{children}</FrameBody>
        </Fade>
      </AnimatePresence>
    </section>
  );
}
