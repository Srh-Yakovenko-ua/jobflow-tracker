import type { InactiveStage } from '@jobflow/shared';

import { ApplicationCard, OutcomeBadge } from '@/entities/application';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import { SPECIMEN_CONTEXT, WARN_CARD } from '../dev/ui/card-specimens';
import { SectionHeader } from './section-header';
import { SURFACE_SWATCHES } from './specimen';

const COPY = uk.designSystem.darkTheme;

const DARK_OUTCOMES: readonly InactiveStage[] = ['offer', 'rejected', 'ghosted'];

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
            <ApplicationCard application={WARN_CARD} context={SPECIMEN_CONTEXT} />
            <div className="flex flex-wrap gap-2">
              {DARK_OUTCOMES.map((outcome) => (
                <OutcomeBadge key={outcome} outcome={outcome} />
              ))}
            </div>
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
