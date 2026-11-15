import type { ReactNode } from 'react';

import { ANALYTICS_ANCHORS, type AnalyticsBlock } from '@/shared/lib/analytics-anchors';
import { cn } from '@/shared/lib/cn';

import { matchBarsOf } from '../lib/match-bars';
import { salaryBarsOf } from '../lib/salary-bars';
import { sourcesViewOf } from '../lib/source-bars';
import { timingBarsOf } from '../lib/timing-bars';
import type { DashboardView } from '../model/dashboard-view';
import type { DashboardModel } from '../model/use-dashboard-model';
import { EvidenceBlock } from './evidence-block';
import { ForecastBlock } from './forecast-block';
import { KpiRow } from './kpi-row';
import { ReasonsBlock } from './reasons-block';
import { ResumeAbBlock } from './resume-ab-block';
import { SankeyBlock } from './sankey-block';
import { WhatToDoPanel } from './what-to-do-panel';

const GRID = 'grid items-start gap-4.5';

const NARROW_COLUMNS = 'grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))]';

export type DashboardLayout = 'dashboard' | 'report';

type LayoutLook = Readonly<{ block: string; pageBreak: string; extras: boolean }>;

const LAYOUTS: Record<DashboardLayout, LayoutLook> = {
  dashboard: { block: '', pageBreak: '', extras: true },
  report: { block: 'break-inside-avoid', pageBreak: 'print:break-before-page', extras: false },
};

export type DashboardBlocksModel = Pick<
  DashboardModel,
  'view' | 'silenceDays' | 'sankey' | 'forecast'
>;

export type DashboardBlocksProps = Readonly<{
  model: DashboardBlocksModel;
  layout: DashboardLayout;
}>;

type AnchoredProps = Readonly<{ block: AnalyticsBlock; look: LayoutLook; children: ReactNode }>;

function Anchored({ block, look, children }: AnchoredProps) {
  return (
    <div id={ANALYTICS_ANCHORS[block]} className={cn('min-w-0 scroll-mt-24', look.block)}>
      {children}
    </div>
  );
}

type DashboardExtrasProps = Readonly<{ view: DashboardView }>;

function DashboardExtras({ view }: DashboardExtrasProps) {
  const { frames } = view;
  return (
    <>
      <div className={cn(GRID, NARROW_COLUMNS)}>
        <EvidenceBlock frame={frames.timings} viewOf={timingBarsOf} />
        <EvidenceBlock frame={frames.matchValidation} viewOf={matchBarsOf} />
        <EvidenceBlock frame={frames.salary} viewOf={salaryBarsOf} />
      </div>
      <WhatToDoPanel view={view.actions} />
    </>
  );
}

export function DashboardBlocks({ model, layout }: DashboardBlocksProps) {
  const { view, silenceDays, sankey, forecast } = model;
  const { frames } = view;
  const look = LAYOUTS[layout];
  return (
    <div className="flex min-w-0 flex-col gap-4.5">
      <Anchored block="kpis" look={look}>
        <KpiRow kpi={view.kpi} silenceDays={silenceDays} />
      </Anchored>
      <Anchored block="funnel" look={look}>
        <SankeyBlock frame={frames.sankey} controls={sankey} />
      </Anchored>
      <div
        className={cn(
          GRID,
          'grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))]',
          look.pageBreak,
        )}
      >
        <Anchored block="reasons" look={look}>
          <ReasonsBlock frame={frames.reasons} />
        </Anchored>
        <Anchored block="sources" look={look}>
          <EvidenceBlock frame={frames.sources} viewOf={sourcesViewOf} />
        </Anchored>
      </div>
      <div className={cn(GRID, NARROW_COLUMNS, look.pageBreak)}>
        <Anchored block="resumeAb" look={look}>
          <ResumeAbBlock frame={frames.resumeAb} />
        </Anchored>
        <Anchored block="forecast" look={look}>
          <ForecastBlock frame={frames.forecast} controls={forecast} />
        </Anchored>
      </div>
      {look.extras && <DashboardExtras view={view} />}
    </div>
  );
}
