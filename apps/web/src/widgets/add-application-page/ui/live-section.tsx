'use client';

import { STAGE_LABELS } from '@jobflow/shared';
import { AnimatePresence } from 'motion/react';
import type { ReactNode } from 'react';

import { StageMarker } from '@/entities/application';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Fade } from '@/shared/ui/fade';
import { STATE_TEXT } from '@/shared/ui/state-text';

export type LiveView = Readonly<{ id: string; preview: ReactNode; panel: ReactNode }>;

export type LiveSectionProps = Readonly<{ view: LiveView }>;

type SwapProps = Readonly<{ id: string; children: ReactNode }>;

const COPY = uk.add.explainer;

export const APPLIED = STAGE_LABELS.applied.labelUk;

export const LIVE_PANEL = 'flex min-w-0 flex-col rounded-lg bg-surface p-6 shadow-e1';

export const LIVE_TITLE = 'font-display text-[26px] leading-[1.2] font-medium';

function Swap({ id, children }: SwapProps) {
  return (
    <div className="relative min-w-0">
      <AnimatePresence mode="popLayout" initial={false}>
        <Fade key={id}>{children}</Fade>
      </AnimatePresence>
    </div>
  );
}

export function LiveSection({ view }: LiveSectionProps) {
  return (
    <section
      id="review"
      aria-label={COPY.title}
      className="flex scroll-mt-6 flex-col gap-5 border-t border-line-soft pt-5.5"
    >
      <div className="flex flex-col gap-1.5">
        <p className="eyebrow text-ink-3">{COPY.eyebrow}</p>
        <h2 className="font-display text-[26px] leading-[1.15] font-medium">{COPY.title}</h2>
      </div>
      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-2.5 rounded-lg bg-surface-3 p-2.5 inset-ring inset-ring-line-soft">
          <div className={cn('flex items-center gap-2 px-1 text-ink-2', STATE_TEXT.eyebrow)}>
            <StageMarker stage="applied" />
            {APPLIED}
          </div>
          <Swap id={view.id}>{view.preview}</Swap>
        </div>
        <Swap id={view.id}>{view.panel}</Swap>
      </div>
    </section>
  );
}
