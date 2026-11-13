'use client';

import type { ChartOptions } from 'chart.js';

import { uk } from '@/shared/i18n';
import { reasonColours, useChartTheme } from '@/shared/lib/chart';

import type { BarActions } from '../lib/bar-look';
import { type ReasonBars, REJECTED_BOARD_HREF } from '../lib/reason-bars';
import { BarPlot } from './bar-plot';

const COPY = uk.analytics.blocks.reasons;

export type ReasonsChartProps = Readonly<{ bars: ReasonBars; actions: BarActions }>;

type TooltipHit = Readonly<{ datasetIndex: number; dataIndex: number; label: string }>;

function lookOf(bars: ReasonBars) {
  return {
    plugins: {
      legend: { position: 'bottom', align: 'start' },
      tooltip: {
        callbacks: {
          title: ([item]: readonly TooltipHit[]) => {
            const bar = item === undefined ? undefined : bars.datasets[item.datasetIndex];
            return item === undefined || bar === undefined
              ? ''
              : COPY.tooltip.title(item.label, COPY.sides[bar.stack]);
          },
          label: ({ datasetIndex, dataIndex }: TooltipHit) =>
            bars.datasets[datasetIndex]?.tips[dataIndex] ?? [],
        },
      },
    },
    scales: { x: { stacked: true, ticks: { stepSize: 5 } }, y: { stacked: true } },
  } satisfies ChartOptions<'bar'>;
}

export function ReasonsChart({ bars, actions }: ReasonsChartProps) {
  const colours = reasonColours(useChartTheme().palette);
  const data = {
    labels: bars.labels,
    datasets: bars.datasets.map((bar) => ({
      label: bar.label,
      data: bar.data,
      stack: bar.stack,
      backgroundColor: colours[bar.code],
      borderRadius: 5,
      borderSkipped: false,
      maxBarThickness: 26,
    })),
  };
  const summary = uk.analytics.summary(
    COPY.table.caption,
    bars.datasets.map(({ label }) => label),
  );
  return (
    <BarPlot
      plot={{ data, look: lookOf(bars), summary }}
      press={{ hrefAt: () => REJECTED_BOARD_HREF, onBar: actions.onBar }}
    />
  );
}
