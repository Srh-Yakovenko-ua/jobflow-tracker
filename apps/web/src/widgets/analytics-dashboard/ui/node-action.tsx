import type { SankeyNode } from '@jobflow/shared';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Tooltip } from '@/shared/ui/tooltip';

import { boardHrefOf } from '../lib/sankey-nodes';

export type FunnelActions = Readonly<{ onExpand: () => void }>;

export type NodeActionProps = Readonly<{
  node: SankeyNode;
  actions: FunnelActions;
  view: Readonly<{ className: string; tip?: ReactNode }>;
  children: ReactNode;
}>;

export function NodeAction({ node, actions, view, children }: NodeActionProps) {
  const href = boardHrefOf(node);
  const target =
    href === null ? (
      <button
        type="button"
        data-node-id={node.id}
        className={view.className}
        onClick={actions.onExpand}
      >
        {children}
      </button>
    ) : (
      <Link href={href} data-node-id={node.id} className={view.className}>
        {children}
      </Link>
    );
  return view.tip === undefined ? target : <Tooltip content={view.tip}>{target}</Tooltip>;
}
