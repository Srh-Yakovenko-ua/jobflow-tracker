'use client';

import { uk } from '@/shared/i18n';
import { ChartTable } from '@/shared/ui/chart-table';

import type { BarActions } from '../lib/bar-look';
import { type ReasonBars, reasonBarsOf } from '../lib/reason-bars';
import type { ReasonsFrame } from '../model/dashboard-view';
import { BarFrame } from './bar-frame';
import { EmptyPlot } from './empty-plot';
import { ReasonsChart } from './reasons-chart';

const COPY = uk.analytics.blocks.reasons;

const TABLE = COPY.table;

const HEADS = [TABLE.stage, TABLE.side, TABLE.reason, TABLE.count, TABLE.share];

export type ReasonsBlockProps = Readonly<{ frame: ReasonsFrame }>;

type ReasonsPlotProps = Readonly<{ bars: ReasonBars; actions: BarActions }>;

function ReasonsPlot({ bars, actions }: ReasonsPlotProps) {
  if (bars.datasets.length === 0) return <EmptyPlot content={COPY.empty} />;
  return (
    <div className="flex min-w-0 flex-col gap-3.5">
      <ReasonsChart bars={bars} actions={actions} />
      <ChartTable caption={TABLE.caption} heads={HEADS} rows={bars.rows} />
    </div>
  );
}

export function ReasonsBlock({ frame }: ReasonsBlockProps) {
  return (
    <BarFrame
      frame={frame}
      plot={(data, actions) => <ReasonsPlot bars={reasonBarsOf(data)} actions={actions} />}
    />
  );
}
