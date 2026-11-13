const ANALYTICS = ['analytics'] as const;

const SUMMARY = [...ANALYTICS, 'summary'] as const;

function searchScoped<Block extends string>(block: Block) {
  return (searchId?: string) => [...SUMMARY, block, { searchId }] as const;
}

export const analyticsKeys = {
  all: ANALYTICS,
  summary: () => SUMMARY,
  norms: () => [...ANALYTICS, 'norms'] as const,
  funnel: searchScoped('funnel'),
  sankey: searchScoped('sankey'),
  reasons: searchScoped('reasons'),
  sources: searchScoped('sources'),
  timings: searchScoped('timings'),
  forecast: searchScoped('forecast'),
  insights: searchScoped('insights'),
};
