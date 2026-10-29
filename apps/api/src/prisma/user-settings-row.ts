import type { UserSettings } from '@jobflow/shared';

import type { Prisma } from '../generated/prisma/client.js';

export const USER_SETTINGS_SELECT = {
  silenceDays: true,
  autoGhostDays: true,
  askRejectionReason: true,
  monthlySummaryEnabled: true,
  theme: true,
  timezone: true,
  quietHoursStart: true,
  quietHoursEnd: true,
  notifyInApp: true,
  notifyPush: true,
  notifyEmail: true,
  analyticsOptOut: true,
  activeResumeVersionId: true,
} as const satisfies Prisma.UserSettingsSelect;

export type UserSettingsRow = Prisma.UserSettingsGetPayload<{
  select: typeof USER_SETTINGS_SELECT;
}>;

const clockTime = (time: Date) => time.toISOString().slice(11, 16);

export function toUserSettings({
  quietHoursStart,
  quietHoursEnd,
  ...settings
}: UserSettingsRow): UserSettings {
  return {
    ...settings,
    quietHoursStart: clockTime(quietHoursStart),
    quietHoursEnd: clockTime(quietHoursEnd),
  };
}
