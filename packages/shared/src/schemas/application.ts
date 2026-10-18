import { z } from 'zod';

import { sourceSchema } from '../sources.js';
import { stageSchema } from '../stages.js';
import { workModeSchema } from '../work-modes.js';

export const applicationSchema = z.object({
  id: z.uuid(),
  searchId: z.uuid(),
  company: z.string().min(1),
  position: z.string().min(1),
  url: z.url().nullable(),
  source: sourceSchema,
  salaryMin: z.int().nonnegative().nullable(),
  salaryMax: z.int().nonnegative().nullable(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable(),
  stack: z.array(z.string()),
  location: z.string().nullable(),
  workMode: workModeSchema.nullable(),
  currentStage: stageSchema,
  isDraft: z.boolean(),
  resumeVersionId: z.uuid().nullable(),
  matchScore: z.int().min(0).max(100).nullable(),
  aiParsed: z.record(z.string(), z.unknown()).nullable(),
  rawText: z.string().nullable(),
  appliedAt: z.iso.datetime().nullable(),
  lastEventAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Application = z.infer<typeof applicationSchema>;
