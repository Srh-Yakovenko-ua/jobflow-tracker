'use client';

import type { FunnelStage, SankeyGraph } from '@jobflow/shared';

import { uk } from '@/shared/i18n';

import { funnelRowsOf } from '../lib/sankey-nodes';
import { FunnelRow } from './funnel-row';
import type { FunnelActions } from './node-action';

const COPY = uk.analytics.blocks.sankey;

export type FunnelChartProps = Readonly<{
  graph: SankeyGraph;
  stages: readonly FunnelStage[] | undefined;
  actions: FunnelActions;
}>;

export function FunnelChart({ graph, stages, actions }: FunnelChartProps) {
  const rows = funnelRowsOf({ graph, stages });
  const top = rows[0]?.reached ?? 0;
  return (
    <ol aria-label={COPY.funnel} className="group/funnel flex min-w-0 flex-col">
      {rows.map((row) => (
        <FunnelRow key={row.node.id} row={row} view={{ top }} stages={stages} actions={actions} />
      ))}
    </ol>
  );
}
