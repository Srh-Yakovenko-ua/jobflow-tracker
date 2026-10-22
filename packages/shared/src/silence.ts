import { z } from 'zod';

import type { UserSettings } from './schemas/user-settings.js';
import { ACTIVE_STAGES, type Stage } from './stages.js';

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
  return daysSinceLastEvent >= Math.ceil(threshold / 2) ? 'warn' : 'none';
}

export function wholeDaysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));
}
