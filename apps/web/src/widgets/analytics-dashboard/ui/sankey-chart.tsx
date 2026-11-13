'use client';

import type { FunnelStage, SankeyGraph, SankeyNode } from '@jobflow/shared';
import { Chart as ChartJs, type ChartEvent } from 'chart.js';
import { merge } from 'chart.js/helpers';
import { Chart } from 'react-chartjs-2';

import { uk } from '@/shared/i18n';
import { type ChartThemeOptions, sankeyNodeColours, useChartTheme } from '@/shared/lib/chart';

import { nodeAt, SANKEY_NODE_WIDTH } from '../lib/node-at';
import { sankeyLayoutOf } from '../lib/sankey-nodes';
import { sankeyTooltipLines } from '../lib/sankey-tooltip';

const CAPTION = uk.analytics.blocks.sankey.caption;

const LAYOUT = { padding: { top: 6, bottom: 6, left: 4, right: 4 } };

export type SankeyChartActions = Readonly<{ onNode: (node: SankeyNode) => void }>;

export type SankeyChartProps = Readonly<{
  graph: SankeyGraph;
  stages: readonly FunnelStage[] | undefined;
  actions: SankeyChartActions;
}>;

type FlowEnds = Readonly<{ raw: Readonly<{ from: string; to: string }> }>;

function canvasOf(event: ChartEvent): HTMLCanvasElement | null {
  const target = event.native?.target;
  return target instanceof HTMLCanvasElement ? target : null;
}

function nodeKeyAt(event: ChartEvent): string | null {
  const canvas = canvasOf(event);
  const chart = canvas === null ? undefined : ChartJs.getChart(canvas);
  if (chart === undefined || event.x === null || event.y === null) return null;
  return nodeAt({ chart, point: { x: event.x, y: event.y } });
}

function lookOf({ graph, stages, actions }: SankeyChartProps) {
  return {
    maintainAspectRatio: false,
    layout: LAYOUT,
    onClick: (event: ChartEvent) => {
      const key = nodeKeyAt(event);
      const node = graph.nodes.find(({ id }) => id === key);
      if (node !== undefined) actions.onNode(node);
    },
    onHover: (event: ChartEvent) => {
      const canvas = canvasOf(event);
      if (canvas !== null) canvas.style.cursor = nodeKeyAt(event) === null ? '' : 'pointer';
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: ({ dataIndex }: Readonly<{ dataIndex: number }>) => {
            const link = graph.links[dataIndex];
            return link === undefined ? '' : sankeyTooltipLines({ link, stages });
          },
        },
      },
    },
  };
}

export function SankeyChart(props: SankeyChartProps) {
  const { palette, options } = useChartTheme();
  const colourOf = sankeyNodeColours(palette);
  const look = lookOf(props);
  const data = {
    datasets: [
      {
        data: [...props.graph.links],
        ...sankeyLayoutOf(props.graph),
        colorFrom: ({ raw }: FlowEnds) => colourOf(raw.from),
        colorTo: ({ raw }: FlowEnds) => colourOf(raw.to),
        colorMode: 'gradient' as const,
        alpha: 0.62,
        borderWidth: 0,
        nodeWidth: SANKEY_NODE_WIDTH,
        nodePadding: 18,
        font: { family: options.font.family, size: 12, weight: 600 },
        color: palette.colors.ink,
      },
    ],
  };
  return (
    <div className="flex min-w-0 flex-col gap-3.5">
      <div className="relative h-95 min-w-0">
        <Chart
          type="sankey"
          aria-hidden
          data={data}
          options={merge<object, ChartThemeOptions, typeof look>({}, [options, look])}
        />
      </div>
      <div className="flex flex-wrap justify-between gap-4 text-[11.5px] text-ink-3">
        <span className="font-semibold tracking-[.1em] uppercase">{CAPTION.thickness}</span>
        <span>{CAPTION.hover}</span>
      </div>
    </div>
  );
}
