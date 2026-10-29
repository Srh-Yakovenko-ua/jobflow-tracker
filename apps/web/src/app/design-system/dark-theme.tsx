import { type Stage, STAGE_LABELS } from '@jobflow/shared';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import { SectionHeader } from './section-header';
import { SURFACE_SWATCHES } from './specimen';

const COPY = uk.designSystem.darkTheme;

const DASHED_RING =
  'm-px size-3.5 flex-none rounded-full border-[1.5px] border-dashed border-ink-3';

const OUTCOME_CHIPS: readonly { stage: Stage; chip: string; marker: string }[] = [
  { stage: 'offer', chip: 'bg-offer/15 text-offer', marker: 'size-2.25 rounded-full bg-offer' },
  {
    stage: 'rejected',
    chip: 'bg-rejected/15 text-rejected',
    marker:
      'flex size-2.25 items-center justify-center rounded-full inset-ring-2 inset-ring-rejected after:h-0.5 after:w-1 after:rounded-xs after:bg-rejected',
  },
  {
    stage: 'ghosted',
    chip: 'bg-ghosted/15 text-ink-3 inset-ring inset-ring-line',
    marker: DASHED_RING,
  },
];

const DATA_SWATCHES = [
  'bg-data-1',
  'bg-data-2',
  'bg-data-3',
  'bg-data-4',
  'bg-data-5',
  'bg-data-6',
] as const;

function SurfacesColumn() {
  return (
    <div className="flex flex-col gap-4.5">
      <span className="text-label leading-[normal] tracking-[0.14em] text-ink-3 uppercase">
        {COPY.surfacesEyebrow}
      </span>
      <div className="grid grid-cols-3 gap-2.5">
        {SURFACE_SWATCHES.map((surface) => (
          <div key={surface.label} className="flex flex-col gap-1.75">
            <span aria-hidden className={cn('h-13 rounded-lg', surface.swatch)} />
            <span className="text-[11px] text-ink-3 tabular-nums">{surface.label}</span>
          </div>
        ))}
      </div>
      <p className="text-body leading-[1.62] text-ink-2 tabular-nums">{COPY.note}</p>
    </div>
  );
}

function ApplicationSample() {
  const card = COPY.card;
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-surface px-4.5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.75">
          <span className="text-[15.5px] leading-[1.32] font-semibold text-ink">{card.title}</span>
          <span className="text-body leading-[normal] text-ink-3">{card.company}</span>
        </div>
        <span className="flex-none rounded-pill bg-accent-tint px-2.5 py-1 text-[13px] font-semibold text-accent-ink tabular-nums">
          {card.score}
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2.5 text-[12.5px] text-ink-3">
        <span className="font-medium tabular-nums">{card.salary}</span>
        <span className="flex items-center gap-1.75 tabular-nums">
          <span aria-hidden className={DASHED_RING} />
          {card.silence}
        </span>
      </div>
    </div>
  );
}

function OutcomeChips() {
  return (
    <div className="flex flex-wrap gap-2">
      {OUTCOME_CHIPS.map((outcome) => (
        <span
          key={outcome.stage}
          className={cn(
            'flex items-center gap-2 rounded-pill px-3.25 py-1.75 text-[13px] font-semibold',
            outcome.chip,
          )}
        >
          <span aria-hidden className={outcome.marker} />
          {STAGE_LABELS[outcome.stage].labelUk}
        </span>
      ))}
    </div>
  );
}

export function DarkThemeSection() {
  return (
    <section id="dark-theme" className="flex flex-col gap-6.5">
      <SectionHeader header={COPY} size="lead" />
      <div className="rounded-3xl shadow-e3">
        <div
          data-theme="dark"
          className="grid grid-cols-[repeat(auto-fit,minmax(min(290px,100%),1fr))] gap-6.5 rounded-3xl bg-paper p-8.5 leading-[normal] text-ink"
        >
          <SurfacesColumn />
          <div className="flex flex-col gap-3.5">
            <ApplicationSample />
            <OutcomeChips />
            <div className="grid grid-cols-6 gap-1.5">
              {DATA_SWATCHES.map((swatch) => (
                <span key={swatch} aria-hidden className={cn('h-8.5 rounded-md', swatch)} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
