import { addDays, formatISO, parseISO, startOfISOWeek } from 'date-fns';

import type {
  RhythmGoal,
  RhythmWeek,
  RhythmWeekCounts,
  RhythmWeekStatus,
} from './schemas/rhythm.js';
import type { UserSettings } from './schemas/user-settings.js';
import { userNow } from './user-time.js';

export type WeekPause = Pick<UserSettings, 'pausedFrom' | 'pausedUntil'>;

export type WeekStatusContext = { goal: RhythmGoal; paused: boolean; current: boolean };

const isoDateOf = (date: Date): string => formatISO(date, { representation: 'date' });

export const localDateOf = (settings: Pick<UserSettings, 'timezone'>, at: Date): string =>
  isoDateOf(userNow(settings, at));

export const weekStartOf = (settings: Pick<UserSettings, 'timezone'>, at: Date): string =>
  isoDateOf(startOfISOWeek(userNow(settings, at)));

export function isWeekPaused(weekStart: string, { pausedFrom, pausedUntil }: WeekPause): boolean {
  if (pausedFrom === null || pausedUntil === null) return false;
  const weekEnd = isoDateOf(addDays(parseISO(weekStart), 6));
  return weekStart <= pausedUntil && pausedFrom <= weekEnd;
}

function isInRhythm(week: RhythmWeekCounts, { applications, followups }: RhythmGoal): boolean {
  if (week.interviews > 0 || week.offers > 0) return true;
  const followupsMet = followups === null || week.followups >= followups;
  return applications !== null && week.applications >= applications && followupsMet;
}

export function weekStatusOf(
  week: RhythmWeekCounts,
  { goal, paused, current }: WeekStatusContext,
): RhythmWeekStatus {
  if (goal.applications === null) return 'no_goal';
  if (paused) return 'paused';
  if (isInRhythm(week, goal)) return 'in_rhythm';
  return current ? 'in_progress' : 'next_week';
}

const SKIPPED_BY_STREAK: ReadonlySet<RhythmWeekStatus> = new Set(['paused', 'in_progress']);

export function streakOf(weeks: readonly Pick<RhythmWeek, 'status'>[]): number {
  return weeks
    .filter(({ status }) => !SKIPPED_BY_STREAK.has(status))
    .reduce((streak, { status }) => (status === 'in_rhythm' ? streak + 1 : 0), 0);
}
