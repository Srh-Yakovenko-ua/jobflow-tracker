'use client';

import type { FunnelStage } from '@jobflow/shared';
import { TrendingDown } from 'lucide-react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { GrowBar } from '@/shared/ui/grow-bar';

import type { FunnelRow as Row } from '../lib/sankey-nodes';
import { FunnelExits } from './funnel-exits';
import { type FunnelActions, NodeAction } from './node-action';

const COPY = uk.analytics.blocks.sankey;

const ROW = cn(
  'flex min-w-0 flex-col gap-1.5 py-1.5 shadow-[inset_0_-1px_0_var(--line-soft)] last:shadow-none',
  '[&_[aria-hidden]]:transition-opacity [&_[aria-hidden]]:duration-(--duration-fast) [&_[aria-hidden]]:ease-standard',
  'pointer-fine:group-has-[li:hover]/funnel:not-hover:[&_[aria-hidden]]:opacity-55',
  'group-has-[:focus-visible]/funnel:not-has-[:focus-visible]:[&_[aria-hidden]]:opacity-55',
);

const STAGE_ACTION =
  'inline-flex min-h-11 items-center rounded-sm text-[14px] font-semibold text-ink tabular-nums underline-offset-2 hover:underline active:underline';

export type FunnelRowProps = Readonly<{
  row: Row;
  view: Readonly<{ top: number }>;
  stages: readonly FunnelStage[] | undefined;
  actions: FunnelActions;
}>;

function BiggestDrop() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface-2 px-2 py-0.5 text-[12px] font-semibold text-ink">
      <TrendingDown aria-hidden size={16} strokeWidth={1.9} className="flex-none" />
      {COPY.biggestDrop}
    </span>
  );
}

function shareOf(count: number, top: number): number {
  return top === 0 ? 0 : count / top;
}

export function FunnelRow({ row, view, stages, actions }: FunnelRowProps) {
  const exited = row.exits.reduce((total, exit) => total + exit.link.flow, 0);
  return (
    <li className={ROW}>
      <div className="flex flex-wrap items-center justify-between gap-x-3">
        <NodeAction node={row.node} actions={actions} view={{ className: STAGE_ACTION }}>
          {row.label}
        </NodeAction>
        {row.biggestDrop && <BiggestDrop />}
      </div>
      <GrowBar
        share={shareOf(row.reached, view.top)}
        className="h-3 min-w-1.5 rounded-[3px] bg-data-2"
      />
      {row.rate !== null && (
        <p className="text-[13px] leading-normal text-pretty text-ink-2 tabular-nums">{row.rate}</p>
      )}
      {row.exits.length > 0 && (
        <>
          <GrowBar share={shareOf(exited, view.top)} className="mt-1 h-2 gap-0.5">
            {row.exits.map(({ node, link, fill }) => (
              <span
                key={node.id}
                className={cn('h-full min-w-1.5 basis-0 rounded-[2px]', fill)}
                style={{ flexGrow: link.flow }}
              />
            ))}
          </GrowBar>
          <FunnelExits exits={row.exits} stages={stages} actions={actions} />
        </>
      )}
    </li>
  );
}
