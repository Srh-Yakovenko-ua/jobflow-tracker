import { buildDesignSankey } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { sankeyCountLabel, sankeyNodeTotal } from './sankey-names';

const DESIGN = buildDesignSankey().merged;

describe('sankeyNodeTotal', () => {
  it('counts each node of the 54 application search by the larger of what came in and what went out', () => {
    const totalOf = sankeyNodeTotal(DESIGN);

    expect(DESIGN.nodes.map(({ id }) => [id, totalOf(id)])).toEqual([
      ['applied', 54],
      ['screening', 17],
      ['tech_interview', 9],
      ['final', 4],
      ['offer', 1],
      ['rejected', 32],
      ['ghosted', 17],
      ['withdrawn', 4],
    ]);
  });

  it('counts a node no flow touches as 0', () => {
    expect(sankeyNodeTotal(DESIGN)('in_progress')).toBe(0);
  });
});

describe('sankeyCountLabel', () => {
  it('names the node in Ukrainian and puts its count after the name', () => {
    expect(sankeyCountLabel({ id: 'tech_interview', count: 9 })).toBe("техінтерв'ю 9");
    expect(sankeyCountLabel({ id: 'rejected', count: 32 })).toBe('відмова 32');
  });
});
