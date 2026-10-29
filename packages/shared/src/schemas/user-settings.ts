import { z } from 'zod';

import { themeSchema } from '../themes.js';
import { isNonEmptyPatch, NON_EMPTY_PATCH_ISSUE } from './patch.js';

const clockTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const USER_SETTINGS_LIMITS = {
  silenceDays: { min: 3, max: 30 },
  autoGhostDays: { min: 14, max: 90 },
} as const;

const isKnownTimeZone = (timeZone: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
};

export const timezoneSchema = z
  .string()
  .max(64)
  .regex(/^[A-Z][A-Za-z0-9_+-]*(?:\/[A-Z0-9][A-Za-z0-9_+-]*)*$/, { abort: true })
  .refine(isKnownTimeZone, { error: 'Unknown IANA time zone' });

export const userSettingsSchema = z.object({
  silenceDays: z.int(),
  autoGhostDays: z.int().nullable(),
  askRejectionReason: z.boolean(),
  monthlySummaryEnabled: z.boolean(),
  theme: themeSchema,
  timezone: z.string().min(1),
  quietHoursStart: clockTimeSchema,
  quietHoursEnd: clockTimeSchema,
  notifyInApp: z.boolean(),
  notifyPush: z.boolean(),
  notifyEmail: z.boolean(),
  analyticsOptOut: z.boolean(),
  activeResumeVersionId: z.uuid().nullable(),
});

const { silenceDays, autoGhostDays } = USER_SETTINGS_LIMITS;

export const userSettingsPatchSchema = userSettingsSchema
  .omit({ activeResumeVersionId: true })
  .extend({
    silenceDays: z.int().min(silenceDays.min).max(silenceDays.max),
    autoGhostDays: z.int().min(autoGhostDays.min).max(autoGhostDays.max).nullable(),
    timezone: timezoneSchema,
  })
  .partial();

export const updateUserSettingsInputSchema = userSettingsPatchSchema.refine(
  isNonEmptyPatch,
  NON_EMPTY_PATCH_ISSUE,
);

export const settingsSuggestionsSchema = z.object({
  silenceDays: z.int(),
  medianResponseDays: z.int().nonnegative().nullable(),
  answeredApplications: z.int().nonnegative(),
});

export type UserSettings = z.infer<typeof userSettingsSchema>;
export type UpdateUserSettingsInput = z.infer<typeof updateUserSettingsInputSchema>;
export type SettingsSuggestions = z.infer<typeof settingsSuggestionsSchema>;
