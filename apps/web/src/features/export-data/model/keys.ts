export const exportKeys = {
  all: ['data-export'] as const,
  link: (exportId: string | null) => [...exportKeys.all, 'link', exportId] as const,
};
