import { REJECTION_REASONS, STAGE_LABELS } from '@jobflow/shared';

import { uk } from '@/shared/i18n';

const LABELLED = [...Object.entries(STAGE_LABELS), ...Object.entries(REJECTION_REASONS)];

const NAMES: Readonly<Record<string, string>> = {
  ...Object.fromEntries(LABELLED.map(([node, { labelUk }]) => [node, labelUk])),
  ...uk.analytics.blocks.sankey.nodes,
};

export type SankeyStep = Readonly<{ from: string; to: string }>;

export type SankeyFlowLine = SankeyStep & Readonly<{ flow: number }>;

export function sankeyNodeName(node: string): string {
  return NAMES[node] ?? node;
}

export function sankeyStepName({ from, to }: SankeyStep): string {
  return `${sankeyNodeName(from)} → ${sankeyNodeName(to)}`;
}

export function sankeyFlowLine({ from, to, flow }: SankeyFlowLine): string {
  return `${sankeyStepName({ from, to })} ${String(flow)}`;
}
