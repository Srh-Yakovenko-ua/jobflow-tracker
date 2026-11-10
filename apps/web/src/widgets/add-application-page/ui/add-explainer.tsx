import { STAGE_LABELS } from '@jobflow/shared';

import { StageMarker } from '@/entities/application';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { SHIMMER } from '@/shared/ui/shimmer';
import { STATE_TEXT } from '@/shared/ui/state-text';

const COPY = uk.add.explainer;

const APPLIED = STAGE_LABELS.applied.labelUk;

const BAR = cn('rounded-xs', SHIMMER);

function ProcessingCard() {
  return (
    <div
      aria-hidden
      className="flex flex-col gap-2.5 rounded-lg bg-surface-3 p-2.5 inset-ring inset-ring-line-soft"
    >
      <div className={cn('flex items-center gap-2 px-1 text-ink-2', STATE_TEXT.eyebrow)}>
        <StageMarker stage="applied" />
        {APPLIED}
      </div>
      <div className="flex flex-col gap-2.5 rounded-md bg-surface p-3.5 shadow-e1">
        <div className={cn('flex items-center gap-1.75 text-link', STATE_TEXT.eyebrow)}>
          <span className="size-1.5 flex-none rounded-pill bg-accent motion-safe:animate-pulse" />
          {COPY.processing}
        </div>
        <div className={cn('h-3.5 w-[82%]', BAR)} />
        <div className={cn('h-2.75 w-[56%]', BAR)} />
        <div className="h-px bg-line-soft" />
        <div className={cn('h-2.5 w-[42%]', BAR)} />
      </div>
    </div>
  );
}

export function AddExplainer() {
  return (
    <section
      aria-label={COPY.title}
      className="flex flex-col gap-5 border-t border-line-soft pt-5.5"
    >
      <div className="flex flex-col gap-1.5">
        <p className="eyebrow text-ink-3">{COPY.eyebrow}</p>
        <h2 className="font-display text-[26px] leading-[1.15] font-medium">{COPY.title}</h2>
      </div>
      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
        <ProcessingCard />
        <div className="flex flex-col gap-4.5 rounded-lg bg-surface p-6 shadow-e1">
          <h3 className="font-display text-[26px] leading-[1.2] font-medium">{COPY.panel.title}</h3>
          <p className="max-w-[56ch] text-[15px] leading-[1.6] text-ink-2">
            {COPY.panel.body(APPLIED)}
          </p>
        </div>
      </div>
    </section>
  );
}
