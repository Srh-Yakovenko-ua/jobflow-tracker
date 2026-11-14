'use client';

import type { ChartOptions } from 'chart.js';

import { uk } from '@/shared/i18n';
import { type ChartPalette, useChartTheme } from '@/shared/lib/chart';

import type { BarActions } from '../lib/bar-look';
import type { IntervalBarRow, IntervalBars, IntervalLook } from '../lib/interval-bars';
import { BarPlot } from './bar-plot';

const ANALYTICS = uk.analytics;

const SOURCES_LOOK: Omit<IntervalLook, 'height'> = { radius: 5, thickness: 26 };

export type IntervalBarChartProps = Readonly<{ chart: IntervalBars; actions: BarActions }>;

type TooltipHit = Readonly<{ datasetIndex: number; dataIndex: number }>;

const isColoured = (rows: readonly IntervalBarRow[]) =>
  rows.some(({ colour }) => colour !== undefined);

function lookOf({ rows, scale }: IntervalBars) {
  return {
    interaction: { mode: 'index', axis: 'y', intersect: false },
    plugins: {
      legend: { display: !isColoured(rows), position: 'bottom', align: 'start' },
      tooltip: {
        filter: ({ datasetIndex }: TooltipHit) => datasetIndex === 0,
        callbacks: {
          title: ([item]: readonly TooltipHit[]) =>
            item === undefined ? '' : (rows[item.dataIndex]?.label[0] ?? ''),
          label: ({ dataIndex }: TooltipHit) => [...(rows[dataIndex]?.tip ?? [])],
        },
      },
    },
    scales: {
      x: {
        min: 0,
        ...(scale.max !== undefined && { max: scale.max }),
        ticks: {
          ...(scale.step !== undefined && { stepSize: scale.step }),
          callback: (value: string | number) => scale.tick(Number(value)),
        },
      },
    },
  } satisfies ChartOptions<'bar'>;
}

function fillOf(rows: readonly IntervalBarRow[], palette: ChartPalette) {
  return isColoured(rows) ? rows.map(({ colour = 1 }) => palette.data[colour]) : palette.data[1];
}

export function IntervalBarChart({ chart, actions }: IntervalBarChartProps) {
  const { palette } = useChartTheme();
  const { rows, names, scale } = chart;
  const look = chart.look ?? SOURCES_LOOK;
  const data = {
    labels: rows.map(({ label }) => [...label]),
    datasets: [
      {
        label: names.series,
        data: rows.map(({ value }) => value),
        backgroundColor: fillOf(rows, palette),
        borderRadius: look.radius,
        borderSkipped: false,
        maxBarThickness: look.thickness,
      },
      {
        label: ANALYTICS.interval.label,
        data: rows.map(({ whisker }) => whisker),
        backgroundColor: palette.colors.ink,
        grouped: false,
        barThickness: 2,
      },
    ],
  };
  const summary = ANALYTICS.summary(
    names.caption,
    rows.map(({ label: [name], value }) => `${name} ${scale.format(value)}`),
  );
  return (
    <BarPlot
      plot={{
        data,
        look: lookOf(chart),
        summary,
        ...(chart.look && { height: chart.look.height }),
      }}
      press={{ hrefAt: (index) => rows[index]?.href, onBar: actions.onBar }}
    />
  );
}
