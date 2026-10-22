import { z } from 'zod';

import { silenceLevelSchema } from '../silence.js';
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

export const STACK_MAX_ITEMS = 20;

const STAGE_CHANGE_HINT = 'Stage changes go through POST /applications/:id/events';

const textSchema = z.string().trim().min(1).max(200);
const salarySchema = z.int32().nonnegative().nullable();
const stackSchema = z.array(z.string().trim().min(1).max(50)).max(STACK_MAX_ITEMS);

export const currencySchema = z
  .string()
  .regex(/^[A-Z]{3}$/, { error: 'Use a 3-letter uppercase ISO 4217 code', abort: true })
  .refine((code) => Intl.supportedValuesOf('currency').includes(code), {
    error: 'Unknown ISO 4217 currency code',
  });

const applicationFieldsSchema = z.object({
  company: textSchema,
  position: textSchema,
  url: z
    .url({ protocol: /^https?$/ })
    .max(2048)
    .nullable(),
  source: sourceSchema,
  salaryMin: salarySchema,
  salaryMax: salarySchema,
  currency: currencySchema.nullable(),
  stack: stackSchema,
  location: textSchema.nullable(),
  workMode: workModeSchema.nullable(),
});

const applicationPatchSchema = applicationFieldsSchema.partial();

type ApplicationPatch = z.infer<typeof applicationPatchSchema>;

const salaryRangeIsOrdered = ({ salaryMin, salaryMax }: ApplicationPatch) =>
  typeof salaryMin !== 'number' || typeof salaryMax !== 'number' || salaryMin <= salaryMax;

const salaryRangeIsSentWhole = ({ salaryMin, salaryMax }: ApplicationPatch) =>
  (salaryMin === undefined) === (salaryMax === undefined);

const SALARY_ORDER_ISSUE = {
  error: 'salaryMin must not be greater than salaryMax',
  path: ['salaryMin'],
};

export const createApplicationInputSchema = applicationPatchSchema
  .extend({
    company: textSchema,
    position: textSchema,
    source: sourceSchema.default('other'),
    stack: stackSchema.default([]),
  })
  .refine(salaryRangeIsOrdered, SALARY_ORDER_ISSUE);

export const updateApplicationInputSchema = applicationPatchSchema
  .extend({ currentStage: z.never({ error: STAGE_CHANGE_HINT }).optional() })
  .refine((patch) => Object.keys(patch).length > 0, { error: 'Send at least one field to change' })
  .refine(salaryRangeIsSentWhole, {
    error: 'Send salaryMin and salaryMax together',
    path: ['salaryMin'],
  })
  .refine(salaryRangeIsOrdered, SALARY_ORDER_ISSUE);

export const applicationResponseSchema = applicationSchema.extend({
  daysInStage: z.int().nonnegative(),
  daysSinceLastEvent: z.int().nonnegative(),
  silenceLevel: silenceLevelSchema,
});

export const applicationIdSchema = z.uuid();

export type Application = z.infer<typeof applicationSchema>;
export type CreateApplicationInput = z.infer<typeof createApplicationInputSchema>;
export type UpdateApplicationInput = z.infer<typeof updateApplicationInputSchema>;
export type ApplicationResponse = z.infer<typeof applicationResponseSchema>;
