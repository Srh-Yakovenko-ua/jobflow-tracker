import { z } from 'zod';

export const INSIGHT_BLOCKS = ['funnel', 'reasons', 'sources', 'resume_ab', 'ghosted'] as const;

export const INSIGHT_SEVERITIES = ['positive', 'neutral', 'warning'] as const;

export const insightSchema = z.object({
  block: z.enum(INSIGHT_BLOCKS),
  title: z.string().min(1),
  body: z.string().min(1),
  severity: z.enum(INSIGHT_SEVERITIES),
  evidence: z.record(z.string(), z.union([z.string(), z.number()])),
});

export const insightsResponseSchema = z.object({
  insights: z.array(insightSchema),
});

export type InsightBlock = Insight['block'];
export type InsightSeverity = Insight['severity'];
export type Insight = z.infer<typeof insightSchema>;
export type InsightsResponse = z.infer<typeof insightsResponseSchema>;
