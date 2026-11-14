import type { ReactNode } from 'react';

import { ANALYTICS_ANCHORS, type AnalyticsBlock } from '@/shared/lib/analytics-anchors';
import { cn } from '@/shared/lib/cn';

import type { DashboardView } from '../model/dashboard-view';
import { ForecastBlock, type ForecastControls } from './forecast-block';
import { KpiRow } from './kpi-row';
import { ReasonsBlock } from './reasons-block';
import { SankeyBlock, type SankeyControls } from './sankey-block';
import { SourcesBlock } from './sources-block';
import { WhatToDoPanel } from './what-to-do-panel';

const GRID = 'grid items-start gap-4.5';

export type DashboardBlocksProps = Readonly<{
  view: DashboardView;
  silenceDays: number;
  sankey: SankeyControls;
  forecast: ForecastControls;
}>;

type AnchoredProps = Readonly<{ block: AnalyticsBlock; children: ReactNode }>;

function Anchored({ block, children }: AnchoredProps) {
  return (
    <div id={ANALYTICS_ANCHORS[block]} className="min-w-0 scroll-mt-24">
      {children}
    </div>
  );
}

export function DashboardBlocks({ view, silenceDays, sankey, forecast }: DashboardBlocksProps) {
  const { frames } = view;
  return (
    <div className="flex min-w-0 flex-col gap-4.5">
      <Anchored block="kpis">
        <KpiRow kpi={view.kpi} silenceDays={silenceDays} />
      </Anchored>
      <Anchored block="funnel">
        <SankeyBlock frame={frames.sankey} controls={sankey} />
      </Anchored>
      <div className={cn(GRID, 'grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))]')}>
        <Anchored block="reasons">
          <ReasonsBlock frame={frames.reasons} />
        </Anchored>
        <Anchored block="sources">
          <SourcesBlock frame={frames.sources} />
        </Anchored>
      </div>
      <Anchored block="forecast">
        <ForecastBlock frame={frames.forecast} controls={forecast} />
      </Anchored>
      <WhatToDoPanel view={view.actions} />
    </div>
  );
}
