import type { ForecastQuery, SankeySplit } from '@jobflow/shared';

const ANALYTICS = ['analytics'] as const;

const SUMMARY = [...ANALYTICS, 'summary'] as const;

export type SankeyScope = Readonly<{
  searchId: string | undefined;
  split: SankeySplit | undefined;
}>;

export type ForecastWhatIf = Pick<ForecastQuery, 'applicationsPerWeek' | 'improve'>;

export type ForecastScope = Readonly<{ searchId: string | undefined } & ForecastWhatIf>;

function searchScoped<Block extends string>(block: Block) {
  return (searchId?: string) => [...SUMMARY, block, { searchId }] as const;
}

const forecastSearch = searchScoped('forecast');

export const analyticsKeys = {
  all: ANALYTICS,
  summary: () => SUMMARY,
  norms: () => [...SUMMARY, 'norms'] as const,
  funnel: searchScoped('funnel'),
  sankey: ({ searchId, split }: SankeyScope) =>
    [...SUMMARY, 'sankey', { searchId, split }] as const,
  reasons: searchScoped('reasons'),
  sources: searchScoped('sources'),
  timings: searchScoped('timings'),
  forecastSearch,
  forecast: ({ searchId, applicationsPerWeek, improve }: ForecastScope) =>
    [...forecastSearch(searchId), { applicationsPerWeek, improve }] as const,
  insights: searchScoped('insights'),
  salary: searchScoped('salary'),
  matchValidation: () => [...SUMMARY, 'match-validation'] as const,
};
