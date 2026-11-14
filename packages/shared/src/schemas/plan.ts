import { z } from 'zod';

import { countSchema } from './analytics-funnel.js';
import { isNonEmptyPatch, NON_EMPTY_PATCH_ISSUE } from './patch.js';

export const planItemSchema = z.object({
  id: z.uuid(),
  position: countSchema,
  title: z.string().min(1),
  why: z.string().nullable(),
  expectedEffect: z.string().nullable(),
  metric: z.string().nullable(),
  dueAt: z.iso.datetime().nullable(),
  doneAt: z.iso.datetime().nullable(),
});

export const planSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1),
  month: z.iso.date(),
  aiResultId: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
  items: z.array(planItemSchema),
});

export const planProgressSchema = z.object({ items: countSchema, done: countSchema });

export const latestPlanResponseSchema = z.object({ plan: planSchema.nullable() });

export const planItemPatchSchema = z
  .object({ done: z.boolean(), dueAt: z.iso.datetime().nullable() })
  .partial()
  .refine(isNonEmptyPatch, NON_EMPTY_PATCH_ISSUE);

export const planItemParamsSchema = z.object({ planId: z.uuid(), itemId: z.uuid() });

export type PlanItem = z.infer<typeof planItemSchema>;
export type Plan = z.infer<typeof planSchema>;
export type PlanProgress = z.infer<typeof planProgressSchema>;
export type LatestPlanResponse = z.infer<typeof latestPlanResponseSchema>;
export type PlanItemPatch = z.infer<typeof planItemPatchSchema>;
export type PlanItemParams = z.infer<typeof planItemParamsSchema>;
