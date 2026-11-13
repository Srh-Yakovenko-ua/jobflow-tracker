export const searchKeys = {
  all: ['searches'] as const,
  list: () => [...searchKeys.all, 'list'] as const,
};
