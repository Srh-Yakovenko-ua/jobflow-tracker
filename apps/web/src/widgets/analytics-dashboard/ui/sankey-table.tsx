import type { SankeyGraph, SankeyNode, SankeyNodeId } from '@jobflow/shared';
import Link from 'next/link';

import { uk } from '@/shared/i18n';
import { sankeyNodeName } from '@/shared/lib/chart';
import { cn } from '@/shared/lib/cn';

import { boardHrefOf } from '../lib/sankey-nodes';

const TABLE = uk.analytics.blocks.sankey.table;

const CELL = 'py-1 pr-4 font-normal';

export type SankeyTableProps = Readonly<{ graph: SankeyGraph }>;

type NodeCellProps = Readonly<{ id: SankeyNodeId; node: SankeyNode | undefined }>;

function NodeCell({ id, node }: NodeCellProps) {
  const href = node === undefined ? null : boardHrefOf(node);
  return (
    <td className={CELL}>
      {href === null ? (
        sankeyNodeName(id)
      ) : (
        <Link
          href={href}
          className="inline-flex min-h-11 min-w-11 items-center text-link underline-offset-2 hover:underline"
        >
          {sankeyNodeName(id)}
        </Link>
      )}
    </td>
  );
}

export function SankeyTable({ graph }: SankeyTableProps) {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  return (
    <div className="sr-only overflow-x-auto focus-within:not-sr-only">
      <table className="w-full text-left text-[12.5px] text-ink-2">
        <caption className="eyebrow pb-1.5 text-left text-ink-3">{TABLE.caption}</caption>
        <thead>
          <tr>
            <th scope="col" className={CELL}>
              {TABLE.from}
            </th>
            <th scope="col" className={CELL}>
              {TABLE.to}
            </th>
            <th scope="col" className={CELL}>
              {TABLE.count}
            </th>
          </tr>
        </thead>
        <tbody>
          {graph.links.map((link) => (
            <tr key={`${link.from}>${link.to}`}>
              <NodeCell id={link.from} node={nodes.get(link.from)} />
              <NodeCell id={link.to} node={nodes.get(link.to)} />
              <td className={cn(CELL, 'tabular-nums')}>{String(link.flow)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
