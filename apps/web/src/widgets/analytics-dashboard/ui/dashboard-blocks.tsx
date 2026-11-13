import { cn } from '@/shared/lib/cn';
import { ChartFrame } from '@/shared/ui/chart-frame';

import type { DashboardView } from '../model/dashboard-view';
import { ForecastBlock, type ForecastControls } from './forecast-block';
import { KpiRow } from './kpi-row';
import { ReasonsBlock } from './reasons-block';
import { SankeyBlock, type SankeyControls } from './sankey-block';
import { SourcesBlock } from './sources-block';

const GRID = 'grid items-start gap-4.5';

const NARROW_COLUMNS = 'grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))]';

export type DashboardBlocksProps = Readonly<{
  view: DashboardView;
  silenceDays: number;
  sankey: SankeyControls;
  forecast: ForecastControls;
}>;

export function DashboardBlocks({ view, silenceDays, sankey, forecast }: DashboardBlocksProps) {
  const { frames } = view;
  return (
    <div className="flex min-w-0 flex-col gap-4.5">
      <KpiRow kpi={view.kpi} silenceDays={silenceDays} />
      <SankeyBlock frame={frames.sankey} controls={sankey} />
      <div className={cn(GRID, 'grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))]')}>
        <ReasonsBlock frame={frames.reasons} />
        <SourcesBlock frame={frames.sources} />
      </div>
      <div className={cn(GRID, NARROW_COLUMNS)}>
        <ChartFrame header={frames.resumeAb.header} state={frames.resumeAb.state} />
        <ForecastBlock frame={frames.forecast} controls={forecast} />
      </div>
      <div className={cn(GRID, NARROW_COLUMNS)}>
        <ChartFrame header={frames.timings.header} state={frames.timings.state} />
      </div>
    </div>
  );
}
