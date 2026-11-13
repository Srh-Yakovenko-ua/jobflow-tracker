'use client';

import type { ChartData, ChartOptions } from 'chart.js';
import { merge } from 'chart.js/helpers';
import { Chart } from 'react-chartjs-2';

import { type ChartThemeOptions, useChartTheme } from '@/shared/lib/chart';

import { type BarLook, barLookOf, type BarPress } from '../lib/bar-look';

export type BarPoint = number | [number, number];

export type BarPlotContent = Readonly<{
  data: ChartData<'bar', BarPoint[]>;
  look: ChartOptions<'bar'>;
  summary: string;
}>;

export type BarPlotProps = Readonly<{ plot: BarPlotContent; press: BarPress }>;

export function BarPlot({ plot, press }: BarPlotProps) {
  const { palette, options } = useChartTheme();
  const base = barLookOf({ palette, press });
  return (
    <div className="relative h-55 min-w-0">
      <Chart
        type="bar"
        role="img"
        aria-label={plot.summary}
        data={plot.data}
        options={merge<object, ChartThemeOptions, BarLook, ChartOptions<'bar'>>({}, [
          options,
          base,
          plot.look,
        ])}
      />
    </div>
  );
}
