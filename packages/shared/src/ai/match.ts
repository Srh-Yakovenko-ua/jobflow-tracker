import { z } from 'zod';

import { applicationSchema } from '../schemas/application.js';
import { rawTextSchema } from '../schemas/text.js';
import { RESUME_PARSE_LIMITS, resumeParseOutputSchema } from './resume-parse.js';
import { VACANCY_PARSE_LIMITS, vacancyValueSchemas } from './vacancy-parse.js';

export const MATCH_LIMITS = {
  requirementsMax: 15,
  nameMaxLength: 80,
  explanationMaxLength: 240,
} as const;

export const MATCH_WEIGHTS = ['must', 'nice', 'mentioned'] as const;
export const MATCH_COVERAGES = ['full', 'partial', 'missing'] as const;
export const MATCH_FAILURES = ['no_requirements'] as const;

export const matchWeightSchema = z.enum(MATCH_WEIGHTS);
export const matchCoverageSchema = z.enum(MATCH_COVERAGES);
export const matchFailureSchema = z.enum(MATCH_FAILURES);

const profileShape = resumeParseOutputSchema.shape;

export const matchProfileSchema = resumeParseOutputSchema
  .pick({ totalYears: true, seniority: true, englishLevel: true, domains: true, languages: true })
  .extend({
    skills: z
      .array(profileShape.skills.element.pick({ name: true, years: true }))
      .max(RESUME_PARSE_LIMITS.skillsMax),
    leadership: profileShape.leadership.pick({ hasExperience: true }),
  });

export const matchInputSchema = z.object({
  vacancy: z.object({
    position: applicationSchema.shape.position,
    stack: vacancyValueSchemas.stack,
    text: rawTextSchema(VACANCY_PARSE_LIMITS.textMaxLength).or(z.literal('')),
  }),
  profile: matchProfileSchema,
});

export const matchRequirementSchema = z.object({
  name: z.string().min(1).max(MATCH_LIMITS.nameMaxLength),
  weight: matchWeightSchema,
  coverage: matchCoverageSchema,
});

export const matchOutputSchema = z.object({
  requirements: z.array(matchRequirementSchema).max(MATCH_LIMITS.requirementsMax),
  explanation: z.string().min(1).max(MATCH_LIMITS.explanationMaxLength),
});

export type MatchWeight = z.infer<typeof matchWeightSchema>;
export type MatchCoverage = z.infer<typeof matchCoverageSchema>;
export type MatchFailure = z.infer<typeof matchFailureSchema>;
export type MatchProfile = z.infer<typeof matchProfileSchema>;
export type MatchInput = z.infer<typeof matchInputSchema>;
export type MatchRequirement = z.infer<typeof matchRequirementSchema>;
export type MatchOutput = z.infer<typeof matchOutputSchema>;

export const matchFailure = ({ requirements }: MatchOutput): MatchFailure | null =>
  requirements.some(({ weight }) => weight !== 'mentioned') ? null : 'no_requirements';
