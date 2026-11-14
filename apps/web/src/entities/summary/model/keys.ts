export const summaryKeys = {
  all: ['summaries'] as const,
  latest: () => [...summaryKeys.all, 'latest'] as const,
  archive: () => [...summaryKeys.all, 'archive'] as const,
};
