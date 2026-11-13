import { z } from 'zod';

import { sourceSchema } from '../sources.js';
import { countSchema, insufficientDataSchema, rateResultSchema } from './analytics-funnel.js';

export const sourcesQuerySchema = z.object({ searchId: z.uuid().optional() });

export const responseTimeSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    days: z.number().nonnegative(),
    samples: z.int().positive(),
  }),
  insufficientDataSchema,
]);

export const sourcePerformanceSchema = z.object({
  source: sourceSchema,
  applications: countSchema,
  screenings: countSchema,
  easyApply: countSchema,
  conversion: rateResultSchema,
  ghostRate: rateResultSchema,
  medianResponse: responseTimeSchema,
  note: z.string().nullable(),
});

export const silentGhostsSchema = z
  .object({ total: countSchema, easyApply: countSchema })
  .refine((ghosts) => ghosts.easyApply <= ghosts.total, {
    path: ['easyApply'],
    message: 'Easy Apply silent ghosts exceed all silent ghosts',
  });

export const sourcesResponseSchema = z.object({
  sources: z.array(sourcePerformanceSchema),
  silentGhosts: silentGhostsSchema,
});

export type SourcesQuery = z.infer<typeof sourcesQuerySchema>;
export type ResponseTime = z.infer<typeof responseTimeSchema>;
export type SourcePerformance = z.infer<typeof sourcePerformanceSchema>;
export type SilentGhosts = z.infer<typeof silentGhostsSchema>;
export type SourcesResponse = z.infer<typeof sourcesResponseSchema>;
