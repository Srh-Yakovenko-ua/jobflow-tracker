import { describe, expect, it } from 'vitest';

import { buildDesignSankey, buildFoldedSankey } from '../../testing/index.js';
import { issuePathsOf } from '../test/zod-issues.js';
import { type SankeyGraph, sankeyQuerySchema, sankeyResponseSchema } from './analytics-sankey.js';

const DESIGN_SANKEY = buildDesignSankey();

const [FIRST_LINK, ...OTHER_LINKS] = DESIGN_SANKEY.detailed.links;

function linkRowsOf(graph: SankeyGraph): string[] {
  return graph.links.map(
    (link) => `${link.from}>${link.to} ${String(link.flow)}${link.ghost ? ' ghost' : ''}`,
  );
}

describe('sankeyQuerySchema', () => {
  it('accepts a search with the reason split', () => {
    const query = { searchId: '0b8f5c1e-7a52-4d0e-9f3a-2c6d8e1b4a90', split: 'reason' };
    expect(sankeyQuerySchema.parse(query)).toEqual(query);
  });

  it('refuses a split by source at split', () => {
    const query = { searchId: '0b8f5c1e-7a52-4d0e-9f3a-2c6d8e1b4a90', split: 'source' };
    expect(issuePathsOf(sankeyQuerySchema.safeParse(query))).toEqual(['split']);
  });
});

describe('sankeyResponseSchema', () => {
  it('accepts the 14 design flows with merged equal to detailed', () => {
    expect(linkRowsOf(DESIGN_SANKEY.detailed)).toEqual([
      'applied>screening 17',
      'applied>rejected 21',
      'applied>ghosted 14 ghost',
      'applied>withdrawn 2',
      'screening>tech_interview 9',
      'screening>rejected 5',
      'screening>ghosted 2 ghost',
      'screening>withdrawn 1',
      'tech_interview>final 4',
      'tech_interview>rejected 4',
      'tech_interview>ghosted 1 ghost',
      'final>offer 1',
      'final>rejected 2',
      'final>withdrawn 1',
    ]);
    expect(DESIGN_SANKEY.merged).toEqual(DESIGN_SANKEY.detailed);
  });

  it('accepts a reason split folding a two-wide reason into other', () => {
    const folded = buildFoldedSankey();
    expect(linkRowsOf(folded.detailed)).toEqual([
      'applied>skills_gap 3',
      'applied>english_level 2',
      'applied>in_progress 375',
    ]);
    expect(linkRowsOf(folded.merged)).toEqual([
      'applied>skills_gap 3',
      'applied>other 2',
      'applied>in_progress 375',
    ]);
  });

  it.for([
    {
      label: 'a link with flow 0',
      graph: { ...DESIGN_SANKEY.detailed, links: [{ ...FIRST_LINK, flow: 0 }, ...OTHER_LINKS] },
      path: 'detailed.links.0.flow',
    },
    {
      label: 'an unknown node id',
      graph: { ...DESIGN_SANKEY.detailed, links: [{ ...FIRST_LINK, to: 'hired' }, ...OTHER_LINKS] },
      path: 'detailed.links.0.to',
    },
  ])('refuses $label at $path', ({ graph, path }) => {
    const body = { ...DESIGN_SANKEY, detailed: graph };
    expect(issuePathsOf(sankeyResponseSchema.safeParse(body))).toEqual([path]);
  });
});
