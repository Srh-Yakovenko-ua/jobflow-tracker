import type { ForecastResponse, RhythmGoal, RhythmResponse, RhythmWeek } from '@jobflow/shared';

import { uk } from '@/shared/i18n';
import { formatDayMonth } from '@/shared/lib/state-format';

export type RhythmDot = Readonly<{ weekStart: string; filled: boolean }>;

export type RhythmSummary = Readonly<{
  line: string;
  sentence: string;
  share: number | null;
  dots: readonly RhythmDot[];
  suggestedGoal: number | null;
}>;

export type RhythmForecasts = Readonly<{
  baseline: ForecastResponse | undefined;
  whatIf: ForecastResponse | undefined;
}>;

type WeekProgress = Readonly<{ week: RhythmWeek; goal: RhythmGoal & { applications: number } }>;

const COPY = uk.rhythm;

function progressPartsOf({ week, goal }: WeekProgress): string[] {
  const applications = COPY.applications({ done: week.applications, goal: goal.applications });
  const followups =
    goal.followups === null
      ? COPY.followups(week.followups)
      : COPY.followupsOfGoal({ done: week.followups, goal: goal.followups });
  return [applications, followups];
}

function pausedDayOf(rhythm: RhythmResponse, week: RhythmWeek): string | null {
  if (week.status !== 'paused' || rhythm.pausedUntil === null) return null;
  return formatDayMonth({ at: new Date(rhythm.pausedUntil), timeZone: 'UTC' });
}

export function rhythmSummaryOf(rhythm: RhythmResponse): RhythmSummary | null {
  const week = rhythm.weeks.at(-1);
  const { applications } = rhythm.goal;
  if (week === undefined || applications === null) return null;
  const parts = progressPartsOf({ week, goal: { ...rhythm.goal, applications } });
  const pausedDay = pausedDayOf(rhythm, week);
  const dots = rhythm.weeks.map(({ weekStart, status }) => ({
    weekStart,
    filled: status === 'in_rhythm',
  }));
  const status = pausedDay === null ? COPY.spokenLine(parts) : COPY.paused(pausedDay);
  const inRhythm = dots.filter(({ filled }) => filled).length;
  return {
    line: pausedDay === null ? COPY.line(parts) : status,
    sentence: COPY.sentence({ status, inRhythm, weeks: dots.length }),
    share: pausedDay === null ? Math.min(1, week.applications / applications) : null,
    dots,
    suggestedGoal: rhythm.suggestedGoal === applications ? null : rhythm.suggestedGoal,
  };
}

const medianWeeksOf = (forecast: ForecastResponse | undefined): number | null =>
  forecast?.status === 'ok' ? forecast.medianWeeks : null;

export function weeksSoonerOf({ baseline, whatIf }: RhythmForecasts): number | null {
  const now = medianWeeksOf(baseline);
  const then = medianWeeksOf(whatIf);
  if (now === null || then === null) return null;
  const sooner = Math.round(now - then);
  return sooner > 0 ? sooner : null;
}
