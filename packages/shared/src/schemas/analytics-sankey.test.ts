import { describe, expect, it } from 'vitest';

import { issuePathsOf } from '../test/zod-issues.js';
import {
  sankeyQuerySchema,
  type SankeyResponse,
  sankeyResponseSchema,
} from './analytics-sankey.js';

const DESIGN_GRAPH = {
  nodes: [
    { id: 'applied', kind: 'stage' },
    { id: 'screening', kind: 'stage' },
    { id: 'tech_interview', kind: 'stage' },
    { id: 'final', kind: 'stage' },
    { id: 'offer', kind: 'stage' },
    { id: 'rejected', kind: 'outcome' },
    { id: 'ghosted', kind: 'outcome' },
    { id: 'withdrawn', kind: 'outcome' },
  ],
  links: [
    { from: 'applied', to: 'screening', flow: 17, ghost: false },
    { from: 'applied', to: 'rejected', flow: 21, ghost: false },
    { from: 'applied', to: 'ghosted', flow: 14, ghost: true },
    { from: 'applied', to: 'withdrawn', flow: 2, ghost: false },
    { from: 'screening', to: 'tech_interview', flow: 9, ghost: false },
    { from: 'screening', to: 'rejected', flow: 5, ghost: false },
    { from: 'screening', to: 'ghosted', flow: 2, ghost: true },
    { from: 'screening', to: 'withdrawn', flow: 1, ghost: false },
    { from: 'tech_interview', to: 'final', flow: 4, ghost: false },
    { from: 'tech_interview', to: 'rejected', flow: 4, ghost: false },
    { from: 'tech_interview', to: 'ghosted', flow: 1, ghost: true },
    { from: 'final', to: 'offer', flow: 1, ghost: false },
    { from: 'final', to: 'rejected', flow: 2, ghost: false },
    { from: 'final', to: 'withdrawn', flow: 1, ghost: false },
  ],
} as const satisfies SankeyResponse['detailed'];

const DESIGN_SANKEY = {
  split: null,
  detailed: DESIGN_GRAPH,
  merged: DESIGN_GRAPH,
} as const satisfies SankeyResponse;

const SPLIT_SANKEY = {
  split: 'reason',
  detailed: {
    nodes: [
      { id: 'applied', kind: 'stage' },
      { id: 'skills_gap', kind: 'reason' },
      { id: 'red_flags', kind: 'reason' },
      { id: 'in_progress', kind: 'in_progress' },
    ],
    links: [
      { from: 'applied', to: 'skills_gap', flow: 40, ghost: false },
      { from: 'applied', to: 'red_flags', flow: 2, ghost: false },
      { from: 'applied', to: 'in_progress', flow: 9, ghost: false },
    ],
  },
  merged: {
    nodes: [
      { id: 'applied', kind: 'stage' },
      { id: 'skills_gap', kind: 'reason' },
      { id: 'other', kind: 'other' },
      { id: 'in_progress', kind: 'in_progress' },
    ],
    links: [
      { from: 'applied', to: 'skills_gap', flow: 40, ghost: false },
      { from: 'applied', to: 'other', flow: 2, ghost: false },
      { from: 'applied', to: 'in_progress', flow: 9, ghost: false },
    ],
  },
} as const satisfies SankeyResponse;

const [FIRST_LINK, ...OTHER_LINKS] = DESIGN_GRAPH.links;

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
  it.for([
    { label: 'the 14 design flows', body: DESIGN_SANKEY },
    { label: 'a reason split folding small reasons into other', body: SPLIT_SANKEY },
  ])('accepts $label', ({ body }) => {
    expect(sankeyResponseSchema.parse(body)).toEqual(body);
  });

  it.for([
    {
      label: 'a link with flow 0',
      graph: { ...DESIGN_GRAPH, links: [{ ...FIRST_LINK, flow: 0 }, ...OTHER_LINKS] },
      path: 'detailed.links.0.flow',
    },
    {
      label: 'an unknown node id',
      graph: { ...DESIGN_GRAPH, links: [{ ...FIRST_LINK, to: 'hired' }, ...OTHER_LINKS] },
      path: 'detailed.links.0.to',
    },
  ])('refuses $label at $path', ({ graph, path }) => {
    const body = { ...DESIGN_SANKEY, detailed: graph };
    expect(issuePathsOf(sankeyResponseSchema.safeParse(body))).toEqual([path]);
  });
});
