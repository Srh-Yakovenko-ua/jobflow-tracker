import { z } from 'zod';

import { monthlySummaryOutputSchema } from '../ai/monthly-summary.js';
import { jobStatusSchema } from './job.js';
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

export type Summary = z.infer<typeof summarySchema>;
export type SummaryResponse = z.infer<typeof summaryResponseSchema>;
