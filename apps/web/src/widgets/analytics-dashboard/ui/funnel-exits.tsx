'use client';

import type { FunnelStage } from '@jobflow/shared';

import type { FunnelExit } from '../lib/sankey-nodes';
import { sankeyTooltipLines } from '../lib/sankey-tooltip';
import { type FunnelActions, NodeAction } from './node-action';
import { Swatch } from './swatch';

const EXIT_ACTION =
  'inline-flex min-h-11 items-center gap-1.75 rounded-sm text-ink-2 underline-offset-2 hover:text-ink hover:underline transition-colors duration-(--duration-instant) ease-standard';

export type FunnelExitsProps = Readonly<{
  exits: readonly FunnelExit[];
  stages: readonly FunnelStage[] | undefined;
  actions: FunnelActions;
}>;

type TipLinesProps = Readonly<{ lines: readonly string[] }>;

function TipLines({ lines }: TipLinesProps) {
  return lines.map((line) => (
    <span key={line} className="block tabular-nums">
      {line}
    </span>
  ));
}

export function FunnelExits({ exits, stages, actions }: FunnelExitsProps) {
  return (
    <ul className="flex flex-wrap gap-x-3.5 text-[12.5px] tabular-nums">
      {exits.map(({ link, node, label, fill }) => (
        <li key={node.id}>
          <NodeAction
            node={node}
            actions={actions}
            view={{
              className: EXIT_ACTION,
              tip: <TipLines lines={sankeyTooltipLines({ link, stages })} />,
            }}
          >
            <Swatch fill={fill} />
            {label}
          </NodeAction>
        </li>
      ))}
    </ul>
  );
}
