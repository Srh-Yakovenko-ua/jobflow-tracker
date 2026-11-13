import { Flow } from 'chartjs-chart-sankey';

export const SANKEY_NODE_WIDTH = 14;

const LABEL_ROOM = 3;

export type ValueScale = Readonly<{ getPixelForValue: (value: number) => number }>;

export type NodeHitChart = Readonly<{
  width: number;
  chartArea: Readonly<{ right: number }>;
  scales: Readonly<Record<string, ValueScale | undefined>>;
  getDatasetMeta: (index: number) => Readonly<{ data: readonly object[] }>;
}>;

export type NodeHit = Readonly<{ chart: NodeHitChart; point: Readonly<{ x: number; y: number }> }>;

type PlacedNode = NonNullable<Flow['from']>;

type NodeGeometry = Readonly<{
  x: ValueScale;
  y: ValueScale;
  lastColumn: number;
  columnPadding: number;
}>;

function placedNodesOf(chart: NodeHitChart): PlacedNode[] {
  const flows = chart.getDatasetMeta(0).data.filter((element) => element instanceof Flow);
  const ends = flows.flatMap(({ from, to }) => [from, to]);
  const nodes = ends.filter((node): node is PlacedNode => node !== undefined);
  return [...new Map(nodes.map((node) => [node.key, node])).values()];
}

type NodeTest = Readonly<{ geometry: NodeGeometry; node: PlacedNode; point: NodeHit['point'] }>;

function contains({ geometry, node, point }: NodeTest): boolean {
  const column = node.x ?? 0;
  const shift =
    geometry.lastColumn === 0 ? 0 : (column / geometry.lastColumn) * geometry.columnPadding;
  const left = geometry.x.getPixelForValue(column) - shift;
  const top = geometry.y.getPixelForValue(node.y ?? 0);
  const bottom = geometry.y.getPixelForValue((node.y ?? 0) + node.size);
  const inColumn = point.x >= left && point.x <= left + SANKEY_NODE_WIDTH;
  return inColumn && point.y >= Math.min(top, bottom) && point.y <= Math.max(top, bottom);
}

export function nodeAt({ chart, point }: NodeHit): string | null {
  const { x, y } = chart.scales;
  if (x === undefined || y === undefined) return null;
  const nodes = placedNodesOf(chart);
  const geometry = {
    x,
    y,
    lastColumn: Math.max(0, ...nodes.map((node) => node.x ?? 0)),
    columnPadding: Math.max(
      0,
      SANKEY_NODE_WIDTH + LABEL_ROOM - (chart.width - chart.chartArea.right),
    ),
  };
  return nodes.find((node) => contains({ geometry, node, point }))?.key ?? null;
}
