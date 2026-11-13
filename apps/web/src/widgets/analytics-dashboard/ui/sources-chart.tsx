'use client';

import type { ChartOptions } from 'chart.js';

import { uk } from '@/shared/i18n';
import { useChartTheme } from '@/shared/lib/chart';

import type { BarActions } from '../lib/bar-look';
import type { PlottedSource } from '../lib/source-bars';
import { BarPlot } from './bar-plot';

const ANALYTICS = uk.analytics;

const COPY = ANALYTICS.blocks.sources;

export type SourcesChartProps = Readonly<{
  plotted: readonly PlottedSource[];
  actions: BarActions;
}>;

type TooltipHit = Readonly<{ datasetIndex: number; dataIndex: number }>;

function lookOf(plotted: readonly PlottedSource[]) {
  return {
    interaction: { mode: 'index', axis: 'y', intersect: false },
    plugins: {
      legend: { position: 'bottom', align: 'start' },
      tooltip: {
        filter: ({ datasetIndex }: TooltipHit) => datasetIndex === 0,
        callbacks: {
          title: ([item]: readonly TooltipHit[]) =>
            item === undefined ? '' : (plotted[item.dataIndex]?.label[0] ?? ''),
          label: ({ dataIndex }: TooltipHit) => plotted[dataIndex]?.tip ?? [],
        },
      },
    },
    scales: {
      x: {
        min: 0,
        max: 100,
        ticks: { callback: (value: string | number) => ANALYTICS.percent(Number(value)) },
      },
    },
  } satisfies ChartOptions<'bar'>;
}

export function SourcesChart({ plotted, actions }: SourcesChartProps) {
  const { palette } = useChartTheme();
  const data = {
    labels: plotted.map(({ label }) => label),
    datasets: [
      {
        label: COPY.table.conversion,
        data: plotted.map(({ value }) => value),
        backgroundColor: palette.data[1],
        borderRadius: 5,
        borderSkipped: false,
        maxBarThickness: 26,
      },
      {
        label: COPY.interval,
        data: plotted.map(({ whisker }) => whisker),
        backgroundColor: palette.colors.ink,
        grouped: false,
        barThickness: 2,
      },
    ],
  };
  const summary = ANALYTICS.summary(
    COPY.table.caption,
    plotted.map(({ label: [name], value }) => `${name} ${ANALYTICS.percent(value)}`),
  );
  return (
    <BarPlot
      plot={{ data, look: lookOf(plotted), summary }}
      press={{ hrefAt: (index) => plotted[index]?.href, onBar: actions.onBar }}
    />
  );
}
