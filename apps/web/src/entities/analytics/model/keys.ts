export const analyticsKeys = {
  all: ['analytics'] as const,
  summary: () => [...analyticsKeys.all, 'summary'] as const,
  norms: () => [...analyticsKeys.all, 'norms'] as const,
};
