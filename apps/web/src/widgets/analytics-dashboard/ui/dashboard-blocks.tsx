import { cn } from '@/shared/lib/cn';
import { ChartFrame } from '@/shared/ui/chart-frame';

import type { DashboardFrameId, DashboardView } from '../model/dashboard-view';
import { KpiRow } from './kpi-row';

const GRIDS: readonly { id: string; columns: string; frames: readonly DashboardFrameId[] }[] = [
  {
    id: 'reasons-sources',
    columns: 'grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))]',
    frames: ['reasons', 'sources'],
  },
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

export type DashboardBlocksProps = Readonly<{ view: DashboardView; silenceDays: number }>;

export function DashboardBlocks({ view, silenceDays }: DashboardBlocksProps) {
  const { frames } = view;
  return (
    <div className="flex min-w-0 flex-col gap-4.5">
      <KpiRow kpi={view.kpi} silenceDays={silenceDays} />
      <ChartFrame header={frames.sankey.header} state={frames.sankey.state} />
      {GRIDS.map((grid) => (
        <div key={grid.id} className={cn('grid items-start gap-4.5', grid.columns)}>
          {grid.frames.map((id) => (
            <ChartFrame key={id} header={frames[id].header} state={frames[id].state} />
          ))}
        </div>
      ))}
    </div>
  );
}
