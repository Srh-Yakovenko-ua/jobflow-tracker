export const captureTokenKeys = {
  all: ['capture-tokens'] as const,
  list: () => [...captureTokenKeys.all, 'list'] as const,
};
