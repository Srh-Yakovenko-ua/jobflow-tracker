interface KeyCache {
  getQueryData: (queryKey: readonly unknown[]) => unknown;
  setQueryData: (queryKey: readonly unknown[], data: unknown) => void;
}

declare const queryClient: KeyCache;

export const listQuery = { queryKey: ['applications', 'list'] };

export const detailQuery = { queryKey: ['applications', 'detail'] as const };

export const saveMutation = { mutationKey: ['applications', 'save'] };

queryClient.setQueryData(['applications'], []);

export const cachedBoard = queryClient.getQueryData(['applications', 'board'] as const);
