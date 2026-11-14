import { type FunnelKpis, THRESHOLDS } from '@jobflow/shared';
import Link from 'next/link';
import { type ReactNode, useId } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { buttonLinkClasses } from '@/shared/ui/button';
import { ProgressMeter } from '@/shared/ui/empty-state';

import { KPI_LABEL } from './kpi-tile';

const COPY = uk.analytics.lowDataState;

const DAYS_IN_WEEK = 7;

const CAPTION = 'text-[12.5px] leading-[1.55] text-ink-2';

const DASHED_CARD =
  'flex min-w-0 flex-col gap-2.25 rounded-xl border-[1.5px] border-dashed border-line bg-surface p-3.5';

function weekCaption(daysInSearch: number): string {
  if (daysInSearch < DAYS_IN_WEEK) return COPY.firstWeek;
  return COPY.week(Math.floor(daysInSearch / DAYS_IN_WEEK) + 1);
}

function SentSoFar({ kpis }: Readonly<{ kpis: FunnelKpis }>) {
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-1.75">
      <span id={labelId} className={KPI_LABEL}>
        {uk.analytics.kpi.sent.label}
      </span>
      <span className="font-display text-[34px] leading-none font-semibold tracking-[-0.045em] text-ink tabular-nums">
        {kpis.sent.total}
      </span>
      <span className={CAPTION}>{weekCaption(kpis.daysInSearch)}</span>
    </div>
  );
}

type DashedCardProps = Readonly<{ label: string; children: ReactNode }>;

function DashedCard({ label, children }: DashedCardProps) {
  return (
    <div className={DASHED_CARD}>
      <span className={KPI_LABEL}>{label}</span>
      {children}
    </div>
  );
}

function NextStep({ missing }: Readonly<{ missing: number }>) {
  return (
    <div className="flex min-w-0 flex-col gap-2.25 rounded-xl bg-surface p-3.5 shadow-e1">
      <span className="text-[13.5px] font-semibold text-ink">{COPY.action.title}</span>
      <span className={CAPTION}>{COPY.action.body(missing)}</span>
      <Link
        href="/add"
        className={cn(buttonLinkClasses({ variant: 'primary', size: 'md' }), 'self-start')}
      >
        {COPY.action.cta}
      </Link>
    </div>
  );
}

export type LowDataDashboardProps = Readonly<{
  kpis: FunnelKpis;
  view: Readonly<{ active: boolean }>;
}>;

export function LowDataDashboard({ kpis, view }: LowDataDashboardProps) {
  const sent = kpis.sent.total;
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(232px,100%),1fr))] items-start gap-5 rounded-2xl bg-surface-2 p-6 inset-ring inset-ring-line-soft max-sm:p-4">
      <SentSoFar kpis={kpis} />
      <DashedCard label={COPY.screening.label}>
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-display text-[26px] leading-none font-semibold text-ink-3">
            {uk.analytics.noValue}
          </span>
          <span className={CAPTION}>{COPY.screening.when(THRESHOLDS.MIN_N_INSIGHT)}</span>
        </div>
        <ProgressMeter progress={{ count: sent, goal: THRESHOLDS.MIN_N_INSIGHT }} />
      </DashedCard>
      <DashedCard label={COPY.forecast.label}>
        <span className="text-[14px] leading-[1.4] font-semibold text-ink">
          {COPY.forecast.when(THRESHOLDS.MIN_N_FORECAST)}
        </span>
        <span className={CAPTION}>{COPY.forecast.why}</span>
      </DashedCard>
      {view.active && <NextStep missing={THRESHOLDS.MIN_N_INSIGHT - sent} />}
    </div>
  );
}
