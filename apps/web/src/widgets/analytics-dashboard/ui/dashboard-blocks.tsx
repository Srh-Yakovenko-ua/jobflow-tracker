import { cn } from '@/shared/lib/cn';
import { ChartFrame } from '@/shared/ui/chart-frame';

import type { DashboardFrameId, DashboardView } from '../model/dashboard-view';
import { KpiRow } from './kpi-row';
import { ReasonsBlock } from './reasons-block';
import { SankeyBlock, type SankeyControls } from './sankey-block';
import { SourcesBlock } from './sources-block';

const GRID = 'grid items-start gap-4.5';

const GRIDS: readonly { id: string; columns: string; frames: readonly DashboardFrameId[] }[] = [
  {
    id: 'resume-forecast',
    columns: 'grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))]',
    frames: ['resumeAb', 'forecast'],
  },
  {
    id: 'timings',
    columns: 'grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))]',
    frames: ['timings'],
  },
];

export type DashboardBlocksProps = Readonly<{
  view: DashboardView;
  silenceDays: number;
  sankey: SankeyControls;
}>;

export function DashboardBlocks({ view, silenceDays, sankey }: DashboardBlocksProps) {
  const { frames } = view;
  return (
    <div className="flex min-w-0 flex-col gap-4.5">
      <KpiRow kpi={view.kpi} silenceDays={silenceDays} />
      <SankeyBlock frame={frames.sankey} controls={sankey} />
      <div className={cn(GRID, 'grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))]')}>
        <ReasonsBlock frame={frames.reasons} />
        <SourcesBlock frame={frames.sources} />
      </div>
      {GRIDS.map((grid) => (
        <div key={grid.id} className={cn(GRID, grid.columns)}>
          {grid.frames.map((id) => (
            <ChartFrame key={id} header={frames[id].header} state={frames[id].state} />
          ))}
        </div>
      ))}
    </div>
  );
}
