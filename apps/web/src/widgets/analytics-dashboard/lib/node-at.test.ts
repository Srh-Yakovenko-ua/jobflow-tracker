import { Flow, type FlowOptions } from 'chartjs-chart-sankey';
import { describe, expect, it } from 'vitest';

import { nodeAt, type NodeHitChart } from './node-at';

type PlacedNode = NonNullable<Flow['from']>;

type NodePlace = Readonly<{ key: string; x: number; y: number; size: number }>;

const FLOW_OPTIONS: FlowOptions = {
  alpha: 0.62,
  colorMode: 'gradient',
  colorFrom: 'transparent',
  colorTo: 'transparent',
  hoverColorFrom: 'transparent',
  hoverColorTo: 'transparent',
  flowColor: null,
  orientation: 'horizontal',
  flowLabels: {
    borderRadius: 0,
    color: 'transparent',
    display: false,
    padding: 0,
    position: 'auto',
  },
};

function placed(place: NodePlace): PlacedNode {
  return { ...place, in: place.size, out: place.size, from: [], to: [] };
}

const APPLIED = placed({ key: 'applied', x: 0, y: 0, size: 20 });

const SCREENING = placed({ key: 'screening', x: 1, y: 0, size: 17 });

const REJECTED = placed({ key: 'rejected', x: 1, y: 20, size: 3 });

function flowOf(from: PlacedNode, to: PlacedNode): Flow {
  return new Flow({ x: 0, y: 0, x2: 0, y2: 0, height: 0, from, to, options: FLOW_OPTIONS });
}

const CHART: NodeHitChart = {
  width: 114,
  chartArea: { right: 110 },
  scales: {
    x: { getPixelForValue: (column) => 10 + column * 100 },
    y: { getPixelForValue: (units) => units * 10 },
  },
  getDatasetMeta: () => ({ data: [flowOf(APPLIED, SCREENING), flowOf(APPLIED, REJECTED)] }),
};

describe('nodeAt', () => {
  it.each([
    { where: 'inside the first column node', point: { x: 15, y: 100 }, node: 'applied' },
    {
      where: 'inside the last column node, drawn 13 px left of the axis',
      point: { x: 100, y: 50 },
      node: 'screening',
    },
    { where: 'inside the small node under it', point: { x: 100, y: 215 }, node: 'rejected' },
    { where: 'between the columns, on a flow', point: { x: 50, y: 50 }, node: null },
    { where: 'right of the last node', point: { x: 112, y: 50 }, node: null },
  ])('a pointer $where finds $node', ({ point, node }) => {
    expect(nodeAt({ chart: CHART, point })).toBe(node);
  });

  it('finds nothing before the chart has scales', () => {
    expect(nodeAt({ chart: { ...CHART, scales: {} }, point: { x: 15, y: 100 } })).toBeNull();
  });
});
