export const planKeys = {
  all: ['plans'] as const,
  latest: () => [...planKeys.all, 'latest'] as const,
};
