'use client';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { LoadFailedAlert } from '@/shared/ui/banner';
import { LoadFailedPanel } from '@/shared/ui/error-panel';

import { useCalendarPage } from '../model/use-calendar-page';
import { CalendarEmpty } from './calendar-empty';
import { CalendarGrid } from './calendar-grid';
import { CalendarLegend } from './calendar-legend';
import { CalendarToolbar } from './calendar-toolbar';

const GRID_HEIGHT = 'min-h-115';

function GridSkeleton() {
  return (
    <div
      aria-busy="true"
      className={cn(GRID_HEIGHT, 'rounded-lg bg-surface-2 inset-ring inset-ring-line-soft')}
    >
      <p role="status" className="sr-only">
        {uk.ui.loading}
      </p>
    </div>
  );
}

export function CalendarPage() {
  const { grid, toolbar, load, emptyWeek } = useCalendarPage();
  const gridHidden = load.pending || load.failed;
  return (
    <section className="flex min-w-0 flex-col gap-3.5 rounded-2xl bg-surface p-4 shadow-e1">
      <CalendarToolbar period={toolbar.period} actions={toolbar.actions} />
      {load.stale && <LoadFailedAlert onRetry={load.onRetry} />}
      {emptyWeek && <CalendarEmpty week={emptyWeek} />}
      {load.pending && <GridSkeleton />}
      {load.failed && <LoadFailedPanel onRetry={load.onRetry} />}
      <div hidden={gridHidden} className={GRID_HEIGHT}>
        {grid && <CalendarGrid calendar={grid.calendar} actions={grid.actions} />}
      </div>
      <CalendarLegend />
    </section>
  );
}
