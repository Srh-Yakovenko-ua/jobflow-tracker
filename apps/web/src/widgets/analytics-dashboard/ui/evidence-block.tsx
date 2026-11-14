'use client';

import { ChartTable } from '@/shared/ui/chart-table';

import type { BarActions } from '../lib/bar-look';
import type { EvidenceView, NoteLine } from '../lib/interval-bars';
import type { DashboardFrame } from '../model/dashboard-view';
import { BarFrame } from './bar-frame';
import { EmptyPlot } from './empty-plot';
import { IntervalBarChart } from './interval-bar-chart';
import { SmallSampleNote } from './small-sample-note';

export type EvidenceBlockProps<Data> = Readonly<{
  frame: DashboardFrame & Readonly<{ data: Data | undefined }>;
  viewOf: (data: Data) => EvidenceView;
}>;

type EvidenceNotesProps = Readonly<{ notes: readonly NoteLine[] }>;

function EvidenceNotes({ notes }: EvidenceNotesProps) {
  if (notes.length === 0) return null;
  return (
    <div className="flex flex-col gap-0.5 py-0.5 pl-3.25 text-[13px] leading-[1.6] text-pretty text-ink-2 tabular-nums shadow-[inset_2px_0_0_var(--accent)]">
      {notes.map(({ key, text }) => (
        <p key={key}>{text}</p>
      ))}
    </div>
  );
}

type EvidencePlotProps = Readonly<{ view: EvidenceView; actions: BarActions }>;

function EvidencePlot({ view, actions }: EvidencePlotProps) {
  if (view.status === 'empty') return <EmptyPlot content={view.content} />;
  return (
    <div className="flex min-w-0 flex-col gap-3.5">
      {view.chart.rows.length > 0 && <IntervalBarChart chart={view.chart} actions={actions} />}
      <EvidenceNotes notes={view.notes} />
      <SmallSampleNote lines={view.small} />
      <ChartTable {...view.table} />
    </div>
  );
}

export function EvidenceBlock<Data>({ frame, viewOf }: EvidenceBlockProps<Data>) {
  return (
    <BarFrame
      frame={frame}
      plot={(data, actions) => <EvidencePlot view={viewOf(data)} actions={actions} />}
    />
  );
}
