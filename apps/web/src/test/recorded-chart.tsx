import type { ChartEvent } from 'chart.js';
import type { ChartProps } from 'react-chartjs-2';

export type BarHit = Readonly<{ datasetIndex: number; index: number }>;

export type BarClick = (event: ChartEvent, elements: readonly BarHit[]) => void;

export type RecordedBarChart = ChartProps<'bar'> & Readonly<{ options?: { onClick?: BarClick } }>;

type RecordedChart = ChartProps<'sankey'> | RecordedBarChart;

const drawn: RecordedChart[] = [];

export const CLICK: ChartEvent = { type: 'click', native: null, x: 0, y: 0 };

export function Chart(props: RecordedChart) {
  const index = drawn.push(props) - 1;
  return (
    <canvas
      role={props.role}
      aria-label={props['aria-label']}
      aria-hidden={props['aria-hidden']}
      data-drawn={index}
    />
  );
}

function isSankey(chart: RecordedChart): chart is ChartProps<'sankey'> {
  return chart.type === 'sankey';
}

function isBar(chart: RecordedChart | undefined): chart is RecordedBarChart {
  return chart?.type === 'bar';
}

export function lastDrawnChart(): ChartProps<'sankey'> {
  const last = drawn.filter(isSankey).at(-1);
  if (last === undefined) throw new Error('no sankey drawn yet');
  return last;
}

export function drawnChartIn(frame: HTMLElement): RecordedBarChart {
  const index = frame.querySelector('canvas')?.dataset.drawn;
  const chart = index === undefined ? undefined : drawn[Number(index)];
  if (!isBar(chart)) throw new Error('no bar chart drawn in this frame');
  return chart;
}
