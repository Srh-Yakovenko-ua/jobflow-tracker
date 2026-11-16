import {
  type ForecastQuery,
  type ForecastResponse,
  type RhythmResponse,
  rhythmResponseSchema,
} from '@jobflow/shared';
import { buildForecastAt, DESIGN_STORY_PACE } from '@jobflow/shared/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';

import type { ForecastAt } from '../modules/rhythm/index.js';
import { callRoute } from './http.js';

export const RHYTHM_PATH = '/api/v1/rhythm';

export type RhythmRead = { accessToken?: string | undefined; query?: string };

export const rhythmResponseOf = (
  app: NestExpressApplication,
  { accessToken, query = '' }: RhythmRead,
) => callRoute(app, { method: 'get', path: `${RHYTHM_PATH}${query}`, accessToken });

export async function rhythmOf(
  app: NestExpressApplication,
  read: RhythmRead,
): Promise<RhythmResponse> {
  return rhythmResponseSchema.parse((await rhythmResponseOf(app, read)).body);
}

const DESIGN_STORY_WEEKS = DESIGN_STORY_PACE.medianWeeks * DESIGN_STORY_PACE.applicationsPerWeek;

const hundredths = (weeks: number) => Math.round(weeks * 100) / 100;

export const designStoryForecastAt = (
  applicationsPerWeek: number = DESIGN_STORY_PACE.applicationsPerWeek,
): ForecastResponse =>
  buildForecastAt({
    applicationsPerWeek,
    medianWeeks: hundredths(DESIGN_STORY_WEEKS / applicationsPerWeek),
  });

export function recordedForecastAt(
  answer: (query: Pick<ForecastQuery, 'applicationsPerWeek'>) => ForecastResponse,
) {
  const calls: (number | undefined)[] = [];
  const forecastAt: ForecastAt = (query) => {
    calls.push(query.applicationsPerWeek);
    return Promise.resolve(answer(query));
  };
  return { calls, forecastAt };
}
