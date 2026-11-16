import { TZDate } from '@date-fns/tz';
import type { UserSettings } from '@jobflow/shared';
import { format } from 'date-fns';

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
  emailMonthlySummary: true,
  emailSilence: true,
  emailInterviewPrep: true,
  analyticsOptOut: true,
  singleKeyShortcuts: true,
  activeResumeVersionId: true,
  weeklyGoalApplications: true,
  weeklyGoalFollowups: true,
  pausedFrom: true,
  pausedUntil: true,
  suggestedWeeklyGoal: true,
} as const satisfies Prisma.UserSettingsSelect;

export type UserSettingsRow = Prisma.UserSettingsGetPayload<{
  select: typeof USER_SETTINGS_SELECT;
}>;

const utcFormat = (time: Date, pattern: string) => format(new TZDate(time, 'UTC'), pattern);

const clockTime = (time: Date) => utcFormat(time, 'HH:mm');

export const calendarDateOf = (date: Date | null): string | null =>
  date === null ? null : utcFormat(date, 'yyyy-MM-dd');

export const dateColumnOf = (date: string): Date => new Date(`${date}T00:00:00.000Z`);

export function toUserSettings({
  quietHoursStart,
  quietHoursEnd,
  pausedFrom,
  pausedUntil,
  ...settings
}: UserSettingsRow): UserSettings {
  return {
    ...settings,
    quietHoursStart: clockTime(quietHoursStart),
    quietHoursEnd: clockTime(quietHoursEnd),
    pausedFrom: calendarDateOf(pausedFrom),
    pausedUntil: calendarDateOf(pausedUntil),
  };
}
