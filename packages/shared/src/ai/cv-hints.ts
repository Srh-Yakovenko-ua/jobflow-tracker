import { z } from 'zod';

import { applicationSchema } from '../schemas/application.js';
import { matchBreakdownSchema } from '../schemas/match.js';
import { MATCH_LIMITS, matchCoverageSchema, matchRequirementSchema } from './match.js';
import { RESUME_PARSE_LIMITS, resumeParseOutputSchema } from './resume-parse.js';

export const CV_HINTS_LIMITS = {
  hintsMax: 5,
  suggestionMaxLength: 240,
} as const;

const profileShape = resumeParseOutputSchema.shape;

export const cvHintsProfileSchema = resumeParseOutputSchema
  .pick({ totalYears: true, seniority: true, englishLevel: true, domains: true, leadership: true })
  .extend({
    skills: z
      .array(profileShape.skills.element.pick({ name: true, years: true, evidence: true }))
      .max(RESUME_PARSE_LIMITS.skillsMax),
    positions: z
      .array(profileShape.positions.element.pick({ title: true, start: true, end: true }))
      .max(RESUME_PARSE_LIMITS.positionsMax),
  });

export const cvHintsRequirementSchema = matchBreakdownSchema.shape.missing.element.extend({
  coverage: matchCoverageSchema,
});

export const cvHintsInputSchema = z.object({
  position: applicationSchema.shape.position,
  score: matchBreakdownSchema.shape.score,
  requirements: z.array(cvHintsRequirementSchema).max(MATCH_LIMITS.requirementsMax),
  profile: cvHintsProfileSchema,
});

export const cvHintSchema = z.object({
  requirement: matchRequirementSchema.shape.name,
  evidenceInCv: z.string().min(1).max(RESUME_PARSE_LIMITS.nameMaxLength),
  suggestion: z.string().min(1).max(CV_HINTS_LIMITS.suggestionMaxLength),
  expectedScoreImpact: z.int().min(0).max(100),
});

export const cvHintsOutputSchema = z.object({
  hints: z.array(cvHintSchema).max(CV_HINTS_LIMITS.hintsMax),
  gaps: z.array(matchRequirementSchema.shape.name).max(MATCH_LIMITS.requirementsMax),
});

export type CvHintsProfile = z.infer<typeof cvHintsProfileSchema>;
export type CvHintsRequirement = z.infer<typeof cvHintsRequirementSchema>;
export type CvHintsInput = z.infer<typeof cvHintsInputSchema>;
export type CvHint = z.infer<typeof cvHintSchema>;
export type CvHintsOutput = z.infer<typeof cvHintsOutputSchema>;
