import { ACTIVE_STAGES, type SankeyGraph, type SankeyNode } from '@jobflow/shared';

import { withSearchParams } from '@/shared/api';
import { sankeyNodeName } from '@/shared/lib/chart';

const STAGE_COLUMNS: Readonly<Record<string, number>> = {
  applied: 0,
  screening: 1,
  tech_interview: 2,
  final: 3,
  offer: 4,
};

const BOARD_STAGES: Record<SankeyNode['kind'], (id: string) => readonly string[] | null> = {
  stage: (id) => [id],
  outcome: (id) => [id],
  reason: () => ['rejected'],
  in_progress: () => ACTIVE_STAGES,
  other: () => null,
};

export type SankeyLayout = Readonly<{
  labels: Record<string, string>;
  column: Record<string, number>;
  priority: Record<string, number>;
}>;

type FlowSide = 'from' | 'to';

function flowThrough({ links }: SankeyGraph, side: FlowSide) {
  return (node: string) =>
    links.reduce((total, link) => (link[side] === node ? total + link.flow : total), 0);
}

export function sankeyLayoutOf(graph: SankeyGraph): SankeyLayout {
  const inflow = flowThrough(graph, 'to');
  const outflow = flowThrough(graph, 'from');
  const ids = graph.nodes.map(({ id }) => id);
  const countOf = (id: string) => Math.max(inflow(id), outflow(id));
  return {
    labels: Object.fromEntries(
      ids.map((id) => [id, `${sankeyNodeName(id)} ${String(countOf(id))}`]),
    ),
    column: { ...STAGE_COLUMNS },
    priority: Object.fromEntries(ids.map((id, order) => [id, order])),
  };
}

export function ghostTotalOf({ links }: SankeyGraph): number {
  return links.reduce((total, link) => (link.ghost ? total + link.flow : total), 0);
}

export function boardHrefOf({ id, kind }: SankeyNode): string | null {
  const stage = BOARD_STAGES[kind](id);
  return stage === null ? null : withSearchParams('/board', { stage });
}
