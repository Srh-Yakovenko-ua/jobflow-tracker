import {
  type RhythmResponse,
  rhythmResponseSchema,
  type RhythmWeek,
  type RhythmWeekStatus,
} from '@jobflow/shared';
import type { HttpResponseResolver } from 'msw';
import { http, HttpResponse } from 'msw/http';

import { addDays } from '@/shared/lib/calendar-month';

import { apiUrl } from './api-handlers';

export const RHYTHM_URL = apiUrl('/rhythm');

const FIRST_WEEK = '2026-09-28';

const DAYS_PER_WEEK = 7;

const DESIGN_STATUSES: readonly RhythmWeekStatus[] = [
  'in_rhythm',
  'next_week',
  'in_rhythm',
  'paused',
  'next_week',
  'in_rhythm',
  'next_week',
  'in_progress',
];

export const DESIGN_DOTS = [true, false, true, false, false, true, false, false] as const;

function weeksOf(statuses: readonly RhythmWeekStatus[]): RhythmWeek[] {
  return statuses.map((status, index) => ({
    weekStart: addDays(FIRST_WEEK, index * DAYS_PER_WEEK),
    status,
    applications: status === 'in_rhythm' ? 9 : 3,
    followups: 1,
    interviews: 0,
    offers: 0,
  }));
}

export function withCurrentWeek(rhythm: RhythmResponse, week: Partial<RhythmWeek>): RhythmResponse {
  const current = rhythm.weeks.at(-1);
  if (current === undefined) return rhythm;
  return { ...rhythm, weeks: [...rhythm.weeks.slice(0, -1), { ...current, ...week }] };
}

export function buildRhythm(overrides: Partial<RhythmResponse> = {}): RhythmResponse {
  const rhythm = rhythmResponseSchema.parse({
    goal: { applications: 8, followups: null },
    suggestedGoal: null,
    pausedFrom: null,
    pausedUntil: null,
    weeks: weeksOf(DESIGN_STATUSES),
    streak: 0,
    bestWeek: { weekStart: FIRST_WEEK, applications: 9 },
    ...overrides,
  });
  return overrides.weeks === undefined
    ? withCurrentWeek(rhythm, { applications: 5, followups: 2 })
    : rhythm;
}

export const RHYTHM_GOAL_OFF = buildRhythm({
  goal: { applications: null, followups: null },
  weeks: weeksOf(DESIGN_STATUSES.map(() => 'no_goal')),
});

export function rhythmRoute(reply: RhythmResponse | HttpResponseResolver = RHYTHM_GOAL_OFF) {
  return http.get(RHYTHM_URL, typeof reply === 'function' ? reply : () => HttpResponse.json(reply));
}
