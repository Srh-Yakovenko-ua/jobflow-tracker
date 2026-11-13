import {
  type SankeyGraph,
  type SankeyResponse,
  sankeyResponseSchema,
} from '../src/schemas/analytics-sankey.js';

const DESIGN_GRAPH: SankeyGraph = {
  links: [
    { flow: 17, from: 'applied', ghost: false, to: 'screening' },
    { flow: 21, from: 'applied', ghost: false, to: 'rejected' },
    { flow: 14, from: 'applied', ghost: true, to: 'ghosted' },
    { flow: 2, from: 'applied', ghost: false, to: 'withdrawn' },
    { flow: 9, from: 'screening', ghost: false, to: 'tech_interview' },
    { flow: 5, from: 'screening', ghost: false, to: 'rejected' },
    { flow: 2, from: 'screening', ghost: true, to: 'ghosted' },
    { flow: 1, from: 'screening', ghost: false, to: 'withdrawn' },
    { flow: 4, from: 'tech_interview', ghost: false, to: 'final' },
    { flow: 4, from: 'tech_interview', ghost: false, to: 'rejected' },
    { flow: 1, from: 'tech_interview', ghost: true, to: 'ghosted' },
    { flow: 1, from: 'final', ghost: false, to: 'offer' },
    { flow: 2, from: 'final', ghost: false, to: 'rejected' },
    { flow: 1, from: 'final', ghost: false, to: 'withdrawn' },
  ],
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
};

const FOLDED_SANKEY: SankeyResponse = {
  detailed: {
    links: [
      { flow: 3, from: 'applied', ghost: false, to: 'skills_gap' },
      { flow: 2, from: 'applied', ghost: false, to: 'english_level' },
      { flow: 375, from: 'applied', ghost: false, to: 'in_progress' },
    ],
    nodes: [
      { id: 'applied', kind: 'stage' },
      { id: 'skills_gap', kind: 'reason' },
      { id: 'english_level', kind: 'reason' },
      { id: 'in_progress', kind: 'in_progress' },
    ],
  },
  merged: {
    links: [
      { flow: 3, from: 'applied', ghost: false, to: 'skills_gap' },
      { flow: 2, from: 'applied', ghost: false, to: 'other' },
      { flow: 375, from: 'applied', ghost: false, to: 'in_progress' },
    ],
    nodes: [
      { id: 'applied', kind: 'stage' },
      { id: 'skills_gap', kind: 'reason' },
      { id: 'other', kind: 'other' },
      { id: 'in_progress', kind: 'in_progress' },
    ],
  },
  split: 'reason',
};

export function buildDesignSankey(): SankeyResponse {
  return sankeyResponseSchema.parse({ detailed: DESIGN_GRAPH, merged: DESIGN_GRAPH, split: null });
}

export function buildFoldedSankey(): SankeyResponse {
  return sankeyResponseSchema.parse(FOLDED_SANKEY);
}
