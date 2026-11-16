import { z } from 'zod';

import { countSchema } from './analytics-funnel.js';
import { USER_SETTINGS_LIMITS } from './user-settings.js';

export const RHYTHM_LIMITS = {
  defaultWeeks: 8,
  maxWeeks: 26,
  maxSuggestedGoal: USER_SETTINGS_LIMITS.weeklyGoal.max,
} as const;

export const rhythmQuerySchema = z.object({
  weeks: z.coerce
    .number()
    .int()
    .min(1)
    .max(RHYTHM_LIMITS.maxWeeks)
    .default(RHYTHM_LIMITS.defaultWeeks),
});

export const RHYTHM_WEEK_STATUSES = [
  'in_rhythm',
  'next_week',
  'paused',
  'in_progress',
  'no_goal',
] as const;

export const rhythmWeekStatusSchema = z.enum(RHYTHM_WEEK_STATUSES);

const goalSchema = z.int().positive().nullable();

export const rhythmGoalSchema = z.object({
  applications: goalSchema,
  followups: goalSchema,
});

export const rhythmWeekCountsSchema = z.object({
  applications: countSchema,
  followups: countSchema,
  interviews: countSchema,
  offers: countSchema,
});

export const rhythmWeekSchema = rhythmWeekCountsSchema.extend({
  weekStart: z.iso.date(),
  status: rhythmWeekStatusSchema,
});

export const rhythmResponseSchema = z.object({
  goal: rhythmGoalSchema,
  suggestedGoal: goalSchema,
  pausedFrom: z.iso.date().nullable(),
  pausedUntil: z.iso.date().nullable(),
  weeks: z.array(rhythmWeekSchema),
  streak: countSchema,
  bestWeek: rhythmWeekSchema.pick({ weekStart: true, applications: true }).nullable(),
});

export type RhythmQuery = z.infer<typeof rhythmQuerySchema>;
export type RhythmWeekStatus = z.infer<typeof rhythmWeekStatusSchema>;
export type RhythmGoal = z.infer<typeof rhythmGoalSchema>;
export type RhythmWeekCounts = z.infer<typeof rhythmWeekCountsSchema>;
export type RhythmWeek = z.infer<typeof rhythmWeekSchema>;
export type RhythmResponse = z.infer<typeof rhythmResponseSchema>;
