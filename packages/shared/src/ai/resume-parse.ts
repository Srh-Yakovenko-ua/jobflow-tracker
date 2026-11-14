import { z } from 'zod';

import { DOCUMENT_LIMITS, documentPageSchema } from '../schemas/document-extraction.js';
import { withoutNul } from '../schemas/text.js';
import { yearMonthSchema } from '../schemas/year-month.js';
import { englishLevelSchema, senioritySchema } from './vacancy-parse.js';

export const RESUME_PARSE_LIMITS = {
  textMaxLength: 40_000,
  skillsMax: 25,
  positionsMax: 10,
  evidenceMaxLength: 120,
  listMax: 10,
  nameMaxLength: 120,
  levelMaxLength: 20,
  yearsMax: 60,
} as const;

export const resumeParseInputSchema = z.object({
  text: z.string().max(RESUME_PARSE_LIMITS.textMaxLength).check(withoutNul),
  pages: z.array(documentPageSchema.shape.jpegBase64).max(DOCUMENT_LIMITS.scanPages),
});

const nameSchema = z.string().min(1).max(RESUME_PARSE_LIMITS.nameMaxLength);
const evidenceSchema = z.string().min(1).max(RESUME_PARSE_LIMITS.evidenceMaxLength).nullable();
const yearsSchema = z.number().min(0).max(RESUME_PARSE_LIMITS.yearsMax);
const positionIndexSchema = z
  .int()
  .min(0)
  .max(RESUME_PARSE_LIMITS.positionsMax - 1);

const resumePositionSchema = z.object({
  title: nameSchema,
  company: nameSchema.nullable(),
  start: yearMonthSchema,
  end: yearMonthSchema.nullable(),
});

const resumeSkillSchema = z.object({
  name: nameSchema,
  years: yearsSchema,
  evidence: evidenceSchema,
  positions: z.array(positionIndexSchema).max(RESUME_PARSE_LIMITS.positionsMax),
});

const resumeLanguageSchema = z.object({
  name: nameSchema,
  level: z.string().min(1).max(RESUME_PARSE_LIMITS.levelMaxLength).nullable(),
});

export const resumeParseOutputSchema = z.object({
  positions: z.array(resumePositionSchema).max(RESUME_PARSE_LIMITS.positionsMax),
  skills: z.array(resumeSkillSchema).max(RESUME_PARSE_LIMITS.skillsMax),
  totalYears: yearsSchema,
  seniority: senioritySchema.nullable(),
  englishLevel: englishLevelSchema.nullable(),
  domains: z.array(nameSchema).max(RESUME_PARSE_LIMITS.listMax),
  leadership: z.object({ hasExperience: z.boolean(), evidence: evidenceSchema }),
  languages: z.array(resumeLanguageSchema).max(RESUME_PARSE_LIMITS.listMax),
});

export type ResumeParseInput = z.infer<typeof resumeParseInputSchema>;
export type ResumeParseOutput = z.infer<typeof resumeParseOutputSchema>;
