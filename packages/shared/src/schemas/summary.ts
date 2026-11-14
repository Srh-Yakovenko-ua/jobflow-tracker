import { z } from 'zod';

import { monthlySummaryOutputSchema } from '../ai/monthly-summary.js';
import { jobStatusSchema } from './job.js';
import { planProgressSchema } from './plan.js';
import { yearMonthSchema } from './year-month.js';

export const summarySchema = z.object({
  aiJobId: z.uuid(),
  month: yearMonthSchema,
  text: monthlySummaryOutputSchema.shape.summary,
  actions: monthlySummaryOutputSchema.shape.actions,
  generatedAt: z.iso.datetime(),
  planId: z.uuid().nullable(),
});

export const summaryResponseSchema = z.object({
  summary: summarySchema.nullable(),
  job: jobStatusSchema.pick({ id: true, status: true }).nullable(),
});

export const SUMMARY_LIMITS = { archiveMonths: 12 } as const;

export const summaryArchiveItemSchema = summarySchema.extend({
  plan: planProgressSchema.nullable(),
});

export const summaryArchiveSchema = z.object({
  items: z.array(summaryArchiveItemSchema).max(SUMMARY_LIMITS.archiveMonths),
});

export type Summary = z.infer<typeof summarySchema>;
export type SummaryResponse = z.infer<typeof summaryResponseSchema>;
export type SummaryArchiveItem = z.infer<typeof summaryArchiveItemSchema>;
export type SummaryArchive = z.infer<typeof summaryArchiveSchema>;
