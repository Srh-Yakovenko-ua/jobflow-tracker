import { type ForecastQuery, type ForecastResponse, RHYTHM_LIMITS } from '@jobflow/shared';

export type ForecastAt = (
  query: Pick<ForecastQuery, 'applicationsPerWeek'>,
) => Promise<ForecastResponse>;

export type RhythmSuggestion = { goal: number | null; weeksSooner: number | null };

export const NO_SUGGESTION: RhythmSuggestion = { goal: null, weeksSooner: null };

const SOONER_BY_WEEKS = 1;

type Found = { goal: number; medianWeeks: number };

type SearchRange = { low: number; high: number; targetWeeks: number };

const medianWeeksOf = (forecast: ForecastResponse): number | null =>
  forecast.status === 'ok' ? forecast.medianWeeks : null;

async function smallestGoal(
  forecastAt: ForecastAt,
  { low, high, targetWeeks }: SearchRange,
): Promise<Found | null> {
  let found: Found | null = null;
  let range = { low, high };
  while (range.low <= range.high) {
    const goal = Math.floor((range.low + range.high) / 2);
    const medianWeeks = medianWeeksOf(await forecastAt({ applicationsPerWeek: goal }));
    const sooner = medianWeeks !== null && medianWeeks <= targetWeeks;
    found = sooner ? { goal, medianWeeks } : found;
    range = sooner ? { ...range, high: goal - 1 } : { ...range, low: goal + 1 };
  }
  return found;
}

export async function suggestedGoalOf(forecastAt: ForecastAt): Promise<RhythmSuggestion> {
  const baseline = await forecastAt({});
  if (baseline.status !== 'ok' || baseline.medianWeeks === null) return NO_SUGGESTION;
  const found = await smallestGoal(forecastAt, {
    low: Math.floor(baseline.applicationsPerWeek) + 1,
    high: RHYTHM_LIMITS.maxSuggestedGoal,
    targetWeeks: baseline.medianWeeks - SOONER_BY_WEEKS,
  });
  if (found === null) return NO_SUGGESTION;
  return { goal: found.goal, weeksSooner: Math.round(baseline.medianWeeks - found.medianWeeks) };
}
