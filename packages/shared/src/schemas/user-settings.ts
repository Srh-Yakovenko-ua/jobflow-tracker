import { z } from 'zod';

import { themeSchema } from '../themes.js';

const clockTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

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

export type UserSettings = z.infer<typeof userSettingsSchema>;
