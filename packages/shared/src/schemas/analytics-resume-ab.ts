import { z } from 'zod';

import {
  countSchema,
  fractionSchema,
  insufficientDataSchema,
  rateResultSchema,
} from './analytics-funnel.js';
import { resumeVersionIdSchema, resumeVersionLabelSchema } from './resume-version.js';

export const RESUME_AB_TESTS = ['z_test', 'fisher_exact'] as const;

const versionNumberSchema = z.int().positive();

export const resumeAbVersionSchema = resumeVersionLabelSchema.extend({
  resumeVersionId: resumeVersionIdSchema,
  applications: countSchema,
  screenings: countSchema,
  conversion: rateResultSchema,
});

export const resumeAbVerdictSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    winner: versionNumberSchema.nullable(),
    message: z.string(),
  }),
  insufficientDataSchema,
]);

export const resumeSwitchSchema = z.object({
  at: z.iso.datetime(),
  before: rateResultSchema,
  after: rateResultSchema,
});

export const resumeAbComparisonSchema = z.object({
  challenger: versionNumberSchema,
  baseline: versionNumberSchema,
  difference: z.number().min(-1).max(1),
  test: z.enum(RESUME_AB_TESTS),
  pValue: fractionSchema,
  probabilityBetter: fractionSchema,
  verdict: resumeAbVerdictSchema,
  switch: resumeSwitchSchema,
});

export const resumeAbResponseSchema = z.object({
  versions: z.array(resumeAbVersionSchema),
  comparison: resumeAbComparisonSchema.nullable(),
});

export type ResumeAbVersion = z.infer<typeof resumeAbVersionSchema>;
export type ResumeAbVerdict = z.infer<typeof resumeAbVerdictSchema>;
export type ResumeSwitch = z.infer<typeof resumeSwitchSchema>;
export type ResumeAbComparison = z.infer<typeof resumeAbComparisonSchema>;
export type ResumeAbResponse = z.infer<typeof resumeAbResponseSchema>;
