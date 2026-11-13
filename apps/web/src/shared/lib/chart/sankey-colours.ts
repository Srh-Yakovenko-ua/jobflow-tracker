import type { RejectionReasonCode, SankeyNodeId } from '@jobflow/shared';

import type { ChartPalette } from './chart-options';

type NamedSankeyNode = Exclude<SankeyNodeId, RejectionReasonCode>;

export function sankeyNodeColours(palette: ChartPalette) {
  const { stage, outcome, colors } = palette;
  const named: Readonly<Record<string, string>> = {
    applied: stage.applied,
    screening: stage.screening,
    tech_interview: stage.tech,
    final: stage.final,
    offer: outcome.offer,
    rejected: outcome.rejected,
    ghosted: outcome.ghosted,
    withdrawn: outcome.withdrawn,
    other: outcome.rejected,
    in_progress: colors['ink-3'],
  } satisfies Record<NamedSankeyNode, string>;
  return (node: string): string => named[node] ?? outcome.rejected;
}
