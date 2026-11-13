import type { ChartEvent } from 'chart.js';
import type { ChartProps } from 'react-chartjs-2';

export type BarHit = Readonly<{ datasetIndex: number; index: number }>;

export type BarClick = (event: ChartEvent, elements: readonly BarHit[]) => void;

export type RecordedBarChart = ChartProps<'bar'> & Readonly<{ options?: { onClick?: BarClick } }>;

const drawn: RecordedBarChart[] = [];

export const CLICK: ChartEvent = { type: 'click', native: null, x: 0, y: 0 };

export function Chart(props: RecordedBarChart) {
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

export function drawnChartIn(frame: HTMLElement): RecordedBarChart {
  const index = frame.querySelector('canvas')?.dataset.drawn;
  const chart = index === undefined ? undefined : drawn[Number(index)];
  if (chart === undefined) throw new Error('no bar chart drawn in this frame');
  return chart;
}
