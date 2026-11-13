'use client';

import { AnimatePresence } from 'motion/react';

import { uk } from '@/shared/i18n';
import { ChartTable } from '@/shared/ui/chart-table';
import { Fade } from '@/shared/ui/fade';

import type { BarActions } from '../lib/bar-look';
import { type SmallSource, type SourceBars, sourceBarsOf } from '../lib/source-bars';
import type { SourcesFrame } from '../model/dashboard-view';
import { BarFrame } from './bar-frame';
import { EmptyPlot } from './empty-plot';
import { SourcesChart } from './sources-chart';

const COPY = uk.analytics.blocks.sources;

const TABLE = COPY.table;

const HEADS = [TABLE.source, TABLE.applications, TABLE.screenings, TABLE.conversion];

export type SourcesBlockProps = Readonly<{ frame: SourcesFrame }>;

type SmallSampleNoteProps = Readonly<{ small: readonly SmallSource[] }>;

function SmallSampleNote({ small }: SmallSampleNoteProps) {
  return (
    <AnimatePresence initial={false}>
      {small.length > 0 && (
        <Fade
          key="small"
          className="flex items-start gap-2.5 rounded-[10px] bg-surface-2 px-3.25 py-2.75 text-[12.5px] leading-normal text-ink-2 tabular-nums"
        >
          <span className="flex-none pt-px text-[11px] font-semibold text-ink-3">
            {COPY.small.tag}
          </span>
          <ul className="flex min-w-0 flex-col gap-1">
            {small.map(({ source, line, note }) => (
              <li key={source}>
                {line} {note}
              </li>
            ))}
          </ul>
        </Fade>
      )}
    </AnimatePresence>
  );
}

type SourcesPlotProps = Readonly<{ bars: SourceBars; actions: BarActions }>;

function SourcesPlot({ bars, actions }: SourcesPlotProps) {
  if (bars.rows.length === 0) return <EmptyPlot content={COPY.empty} />;
  return (
    <div className="flex min-w-0 flex-col gap-3.5">
      {bars.plotted.length > 0 && <SourcesChart plotted={bars.plotted} actions={actions} />}
      <SmallSampleNote small={bars.small} />
      <ChartTable caption={TABLE.caption} heads={HEADS} rows={bars.rows} />
    </div>
  );
}

export function SourcesBlock({ frame }: SourcesBlockProps) {
  return (
    <BarFrame
      frame={frame}
      plot={(data, actions) => <SourcesPlot bars={sourceBarsOf(data)} actions={actions} />}
    />
  );
}
