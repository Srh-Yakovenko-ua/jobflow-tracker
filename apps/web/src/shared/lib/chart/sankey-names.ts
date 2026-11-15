import { REJECTION_REASONS, type SankeyGraph, STAGE_LABELS } from '@jobflow/shared';

import { uk } from '@/shared/i18n';

const LABELLED = [...Object.entries(STAGE_LABELS), ...Object.entries(REJECTION_REASONS)];

const NAMES: Readonly<Record<string, string>> = {
  ...Object.fromEntries(LABELLED.map(([node, { labelUk }]) => [node, labelUk])),
  ...uk.analytics.blocks.sankey.nodes,
};

export type SankeyStep = Readonly<{ from: string; to: string }>;

export type SankeyFlowLine = SankeyStep & Readonly<{ flow: number }>;

export type SankeyFlowSide = keyof SankeyStep;

export type SankeyNodeCount = Readonly<{ id: string; count: number }>;

export function sankeyNodeName(node: string): string {
  return NAMES[node] ?? node;
}

export function sankeyFlowThrough({ links }: SankeyGraph, side: SankeyFlowSide) {
  return (node: string) =>
    links.reduce((total, link) => (link[side] === node ? total + link.flow : total), 0);
}

export function sankeyNodeTotal(graph: SankeyGraph) {
  const inflow = sankeyFlowThrough(graph, 'to');
  const outflow = sankeyFlowThrough(graph, 'from');
  return (node: string) => Math.max(inflow(node), outflow(node));
}

export function sankeyCountLabel({ id, count }: SankeyNodeCount): string {
  return `${sankeyNodeName(id)} ${String(count)}`;
}

export function sankeyStepName({ from, to }: SankeyStep): string {
  return `${sankeyNodeName(from)} → ${sankeyNodeName(to)}`;
}

export function sankeyFlowLine({ from, to, flow }: SankeyFlowLine): string {
  return `${sankeyStepName({ from, to })} ${String(flow)}`;
}
