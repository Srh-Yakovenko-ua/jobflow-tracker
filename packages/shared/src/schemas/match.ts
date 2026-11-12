import { z } from 'zod';

import { matchCoverageSchema, matchRequirementSchema, matchWeightSchema } from '../ai/match.js';
import { jobStatusSchema } from './job.js';
import { resumeVersionSchema } from './resume-version.js';

const scoredRequirementSchema = matchRequirementSchema.pick({ name: true }).extend({
  weight: matchWeightSchema.exclude(['mentioned']),
  pointsLost: z.int().nonnegative(),
});

export const matchBreakdownSchema = z.object({
  score: z.int().min(0).max(100),
  matched: z.array(
    scoredRequirementSchema.extend({ coverage: matchCoverageSchema.exclude(['missing']) }),
  ),
  missing: z.array(scoredRequirementSchema),
  ignored: z.array(matchRequirementSchema.pick({ name: true, coverage: true })),
  explanation: z.string().min(1),
});

export const applicationMatchResponseSchema = z.object({
  match: matchBreakdownSchema
    .extend({
      resumeVersion: resumeVersionSchema.pick({ id: true, number: true, title: true }),
      computedAt: z.iso.datetime(),
    })
    .nullable(),
  job: jobStatusSchema.pick({ id: true, status: true }).nullable(),
});

export type MatchBreakdown = z.infer<typeof matchBreakdownSchema>;
export type ApplicationMatchResponse = z.infer<typeof applicationMatchResponseSchema>;
