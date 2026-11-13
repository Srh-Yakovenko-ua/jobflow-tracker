import { z } from 'zod';

import { rejectionReasonCodeSchema } from '../rejection-reasons.js';
import { stageSchema } from '../stages.js';
import { funnelQuerySchema } from './analytics-funnel.js';

export const SANKEY_SPLITS = ['reason'] as const;

export const SANKEY_EXTRA_NODES = ['in_progress', 'other'] as const;

export const SANKEY_NODE_KINDS = ['stage', 'outcome', 'reason', 'other', 'in_progress'] as const;

const sankeySplitSchema = z.enum(SANKEY_SPLITS);

export const sankeyQuerySchema = funnelQuerySchema.extend({ split: sankeySplitSchema.optional() });

export const sankeyNodeIdSchema = z.union([
  stageSchema,
  rejectionReasonCodeSchema,
  z.enum(SANKEY_EXTRA_NODES),
]);

export const sankeyNodeSchema = z.object({
  id: sankeyNodeIdSchema,
  kind: z.enum(SANKEY_NODE_KINDS),
});

export const sankeyLinkSchema = z.object({
  from: sankeyNodeIdSchema,
  to: sankeyNodeIdSchema,
  flow: z.int().positive(),
  ghost: z.boolean(),
});

export const sankeyGraphSchema = z.object({
  nodes: z.array(sankeyNodeSchema),
  links: z.array(sankeyLinkSchema),
});

export const sankeyResponseSchema = z.object({
  split: sankeySplitSchema.nullable(),
  detailed: sankeyGraphSchema,
  merged: sankeyGraphSchema,
});

export type SankeySplit = z.infer<typeof sankeySplitSchema>;
export type SankeyQuery = z.infer<typeof sankeyQuerySchema>;
export type SankeyNodeId = z.infer<typeof sankeyNodeIdSchema>;
export type SankeyNode = z.infer<typeof sankeyNodeSchema>;
export type SankeyLink = z.infer<typeof sankeyLinkSchema>;
export type SankeyGraph = z.infer<typeof sankeyGraphSchema>;
export type SankeyResponse = z.infer<typeof sankeyResponseSchema>;
