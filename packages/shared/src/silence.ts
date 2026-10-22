import { z } from 'zod';

import type { UserSettings } from './schemas/user-settings.js';
import { ACTIVE_STAGES, type Stage, STAGES } from './stages.js';

export const SILENCE_LEVELS = ['none', 'warn', 'silent'] as const;

export const silenceLevelSchema = z.enum(SILENCE_LEVELS);

export type SilenceLevel = z.infer<typeof silenceLevelSchema>;

export const DEFAULT_SILENCE_DAYS = 7;

const FINAL_STAGE_SILENCE_FACTOR = 2;
const DAY_MS = 24 * 60 * 60 * 1000;

export type SilenceSettings = Pick<UserSettings, 'silenceDays'>;

export type SilenceLevelInput = SilenceSettings & { stage: Stage; daysSinceLastEvent: number };

export function effectiveSilenceDays({ silenceDays }: SilenceSettings, stage: Stage): number {
  return stage === 'final' ? silenceDays * FINAL_STAGE_SILENCE_FACTOR : silenceDays;
}

function warnDaysOf(threshold: number): number {
  return Math.ceil(threshold / 2);
}

export function silenceLevelOf({
  stage,
  silenceDays,
  daysSinceLastEvent,
}: SilenceLevelInput): SilenceLevel {
  if (!ACTIVE_STAGES.includes(stage)) {
    return 'none';
  }
  const threshold = effectiveSilenceDays({ silenceDays }, stage);
  if (daysSinceLastEvent >= threshold) {
    return 'silent';
  }
  return daysSinceLastEvent >= warnDaysOf(threshold) ? 'warn' : 'none';
}

export type SilenceWindow = {
  stages: readonly Stage[];
  lastEventAtOrBefore?: Date;
  lastEventAfter?: Date;
};

export type SilenceWindowsInput = SilenceSettings & {
  levels: readonly SilenceLevel[];
  now: Date;
};

type ThresholdGroup = { stages: readonly Stage[]; threshold: number };

const NEVER_SILENT_STAGES = STAGES.filter((stage) => !ACTIVE_STAGES.includes(stage));

const daysBefore = (now: Date, days: number) => new Date(now.getTime() - days * DAY_MS);

const ACTIVE_WINDOW_OF: Record<SilenceLevel, (group: ThresholdGroup, now: Date) => SilenceWindow> =
  {
    silent: ({ stages, threshold }, now) => ({
      stages,
      lastEventAtOrBefore: daysBefore(now, threshold),
    }),
    warn: ({ stages, threshold }, now) => ({
      stages,
      lastEventAfter: daysBefore(now, threshold),
      lastEventAtOrBefore: daysBefore(now, warnDaysOf(threshold)),
    }),
    none: ({ stages, threshold }, now) => ({
      stages,
      lastEventAfter: daysBefore(now, warnDaysOf(threshold)),
    }),
  };

function thresholdGroupsOf(settings: SilenceSettings): ThresholdGroup[] {
  const stagesByThreshold = new Map<number, Stage[]>();
  for (const stage of ACTIVE_STAGES) {
    const threshold = effectiveSilenceDays(settings, stage);
    stagesByThreshold.set(threshold, [...(stagesByThreshold.get(threshold) ?? []), stage]);
  }
  return [...stagesByThreshold].map(([threshold, stages]) => ({ stages, threshold }));
}

export function silenceWindows({ levels, silenceDays, now }: SilenceWindowsInput): SilenceWindow[] {
  const groups = thresholdGroupsOf({ silenceDays });
  const activeWindows = levels.flatMap((level) =>
    groups.map((group) => ACTIVE_WINDOW_OF[level](group, now)),
  );
  return levels.includes('none')
    ? [...activeWindows, { stages: NEVER_SILENT_STAGES }]
    : activeWindows;
}

export function wholeDaysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));
}
