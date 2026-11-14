import {
  ACTIVE_STAGES,
  type FunnelStage,
  type RateResult,
  type SankeyGraph,
  type SankeyLink,
  type SankeyNode,
  type SankeyResponse,
  STAGES,
} from '@jobflow/shared';

import { withSearchParams } from '@/shared/api';
import { sankeyNodeName } from '@/shared/lib/chart';

import { conversionLine, type StageStep } from './sankey-tooltip';

const ENDINGS = ['offer', 'in_progress', 'withdrawn', 'ghosted', 'rejected'] as const;

export type EndingId = (typeof ENDINGS)[number];

const ENDING_FILL: Record<EndingId, string> = {
  offer: 'bg-offer',
  in_progress: 'bg-ink-3',
  withdrawn: 'bg-withdrawn',
  ghosted: 'bg-ghosted',
  rejected: 'bg-rejected',
};

const EXIT_RANK: Record<EndingId, number> = {
  in_progress: 0,
  withdrawn: 1,
  ghosted: 2,
  rejected: 3,
  offer: 3,
};

const ENDING_OF: Record<SankeyNode['kind'], (id: string) => EndingId | null> = {
  stage: (id) => (id === 'offer' ? 'offer' : null),
  outcome: (id) => ENDINGS.find((ending) => ending === id) ?? null,
  reason: () => 'rejected',
  other: () => 'rejected',
  in_progress: () => 'in_progress',
};

const BOARD_STAGES: Record<SankeyNode['kind'], (id: string) => readonly string[] | null> = {
  stage: (id) => [id],
  outcome: (id) => [id],
  reason: () => ['rejected'],
  in_progress: () => ACTIVE_STAGES,
  other: () => null,
};

export type FunnelExit = Readonly<{
  link: SankeyLink;
  node: SankeyNode;
  label: string;
  fill: string;
}>;

export type FunnelRow = Readonly<{
  node: SankeyNode;
  label: string;
  reached: number;
  passed: number;
  conversion: RateResult | null;
  rate: string | null;
  exits: readonly FunnelExit[];
  biggestDrop: boolean;
}>;

export type FunnelEnding = Readonly<{ id: EndingId; label: string; total: number; fill: string }>;

export type FunnelRowsInput = Readonly<{
  graph: SankeyGraph;
  stages: readonly FunnelStage[] | undefined;
}>;

type FlowSide = 'from' | 'to';

type RowInput = FunnelRowsInput & Readonly<{ node: SankeyNode }>;

function flowThrough({ links }: SankeyGraph, side: FlowSide) {
  return (node: string) =>
    links.reduce((total, link) => (link[side] === node ? total + link.flow : total), 0);
}

function countLabel(id: string, count: number): string {
  return `${sankeyNodeName(id)} ${String(count)}`;
}

function endingOf({ id, kind }: SankeyNode): EndingId | null {
  return ENDING_OF[kind](id);
}

function exitsOf({ graph, node }: RowInput): FunnelExit[] {
  const ranked = graph.links.flatMap((link) => {
    const target = graph.nodes.find(({ id }) => id === link.to);
    const ending = target === undefined || target.kind === 'stage' ? null : endingOf(target);
    if (link.from !== node.id || target === undefined || ending === null) return [];
    const exit = { link, node: target, label: countLabel(target.id, link.flow) };
    return [{ rank: EXIT_RANK[ending], exit: { ...exit, fill: ENDING_FILL[ending] } }];
  });
  return ranked.sort((left, right) => left.rank - right.rank).map(({ exit }) => exit);
}

function stepOf({ stages = [], node }: RowInput): StageStep | null {
  const index = stages.findIndex(({ stage }) => stage === node.id);
  const stage = stages[index];
  return stage === undefined ? null : { stage, next: stages[index + 1] };
}

function rowOf(input: RowInput): FunnelRow {
  const { graph, node } = input;
  const reached = Math.max(flowThrough(graph, 'to')(node.id), flowThrough(graph, 'from')(node.id));
  const stageIds = new Set(graph.nodes.filter(({ kind }) => kind === 'stage').map(({ id }) => id));
  const step = stepOf(input);
  return {
    node,
    label: countLabel(node.id, reached),
    reached,
    passed: graph.links
      .filter((link) => link.from === node.id && stageIds.has(link.to))
      .reduce((total, link) => total + link.flow, 0),
    conversion: step?.stage.conversion ?? null,
    rate: step === null ? null : conversionLine(step),
    exits: exitsOf(input),
    biggestDrop: false,
  };
}

function okValueOf({ conversion }: FunnelRow): number {
  return conversion?.status === 'ok' ? conversion.value : Number.POSITIVE_INFINITY;
}

export function funnelRowsOf({ graph, stages }: FunnelRowsInput): FunnelRow[] {
  const nodes = STAGES.flatMap((stage) =>
    graph.nodes.filter(({ id, kind }) => kind === 'stage' && id === stage),
  );
  const rows = nodes.map((node) => rowOf({ graph, stages, node }));
  const values = rows.map(okValueOf);
  const lowest = Math.min(...values);
  const marked = Number.isFinite(lowest) ? values.indexOf(lowest) : -1;
  return rows.map((row, index) => ({ ...row, biggestDrop: index === marked }));
}

export function endingsOf(graph: SankeyGraph): FunnelEnding[] {
  const inflow = flowThrough(graph, 'to');
  const outflow = flowThrough(graph, 'from');
  const rests = graph.nodes.map((node) => ({
    ending: endingOf(node),
    rest: Math.max(0, inflow(node.id) - outflow(node.id)),
  }));
  return ENDINGS.flatMap((id) => {
    const total = rests.reduce((sum, { ending, rest }) => (ending === id ? sum + rest : sum), 0);
    return total === 0 ? [] : [{ id, label: sankeyNodeName(id), total, fill: ENDING_FILL[id] }];
  });
}

export function ghostTotalOf({ links }: SankeyGraph): number {
  return links.reduce((total, link) => (link.ghost ? total + link.flow : total), 0);
}

export function firstRevealedNode({ detailed, merged }: SankeyResponse): SankeyNode | undefined {
  const folded = new Set(merged.nodes.map(({ id }) => id));
  return detailed.nodes.find(({ id }) => !folded.has(id));
}

export function boardHrefOf({ id, kind }: SankeyNode): string | null {
  const stage = BOARD_STAGES[kind](id);
  return stage === null ? null : withSearchParams('/board', { stage });
}
