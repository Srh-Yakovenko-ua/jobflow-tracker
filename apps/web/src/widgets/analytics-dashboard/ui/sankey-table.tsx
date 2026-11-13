import type { SankeyGraph, SankeyNode, SankeyNodeId } from '@jobflow/shared';

import { uk } from '@/shared/i18n';
import { sankeyNodeName } from '@/shared/lib/chart';
import { ChartTable, type ChartTableCell } from '@/shared/ui/chart-table';

import { boardHrefOf } from '../lib/sankey-nodes';

const TABLE = uk.analytics.blocks.sankey.table;

const HEADS = [TABLE.from, TABLE.to, TABLE.count];

export type SankeyTableProps = Readonly<{ graph: SankeyGraph }>;

function nodeCell(id: SankeyNodeId, node: SankeyNode | undefined): ChartTableCell {
  const href = node === undefined ? null : boardHrefOf(node);
  return { text: sankeyNodeName(id), href: href ?? undefined };
}

export function SankeyTable({ graph }: SankeyTableProps) {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const rows = graph.links.map((link) => ({
    key: `${link.from}>${link.to}`,
    cells: [
      nodeCell(link.from, nodes.get(link.from)),
      nodeCell(link.to, nodes.get(link.to)),
      { text: String(link.flow) },
    ],
  }));
  return <ChartTable caption={TABLE.caption} heads={HEADS} rows={rows} />;
}
