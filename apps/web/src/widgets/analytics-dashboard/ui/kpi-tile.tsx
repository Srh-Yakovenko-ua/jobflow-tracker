'use client';

import { AnimatePresence } from 'motion/react';
import { type ReactNode, useId } from 'react';

import type { ChartFrameState } from '@/shared/ui/chart-frame';
import { LoadFailedPanel } from '@/shared/ui/error-panel';
import { Fade } from '@/shared/ui/fade';
import { LoadingRegion } from '@/shared/ui/loading-region';
import { ChartPlotSkeleton } from '@/shared/ui/skeleton';
import { useSkeletonMotion } from '@/shared/ui/skeleton-motion';

import type { KpiContent } from '../lib/kpi-values';
import { KpiValue } from './kpi-value';

export const KPI_LABEL = 'eyebrow text-ink-3';

export type KpiTileProps = Readonly<{
  label: string;
  state: ChartFrameState;
  content: KpiContent | undefined;
}>;

function ValueSkeleton() {
  const motion = useSkeletonMotion();
  return (
    <LoadingRegion>
      <ChartPlotSkeleton motion={motion} className="h-16" />
    </LoadingRegion>
  );
}

function KpiBody({ state, content }: Omit<KpiTileProps, 'label'>): ReactNode {
  if (content !== undefined) return <KpiValue content={content} />;
  if (state.status === 'failed') {
    return <LoadFailedPanel onRetry={state.onRetry} retrying={state.retrying} />;
  }
  return <ValueSkeleton />;
}

export function KpiTile({ label, state, content }: KpiTileProps) {
  const labelId = useId();
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className="flex min-w-0 flex-col gap-2 rounded-xl bg-surface p-4.5 shadow-e1"
    >
      <span id={labelId} className={KPI_LABEL}>
        {label}
      </span>
      <AnimatePresence mode="popLayout" initial={false}>
        <Fade key={content === undefined ? state.status : 'ready'}>
          <KpiBody state={state} content={content} />
        </Fade>
      </AnimatePresence>
    </div>
  );
}
