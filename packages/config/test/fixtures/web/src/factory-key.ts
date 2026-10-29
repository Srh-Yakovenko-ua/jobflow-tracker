interface KeyCache {
  setQueryData: (queryKey: readonly unknown[], data: unknown) => void;
  invalidateQueries: (filters: { queryKey: readonly unknown[] }) => Promise<void>;
}

interface ApplicationListFilter {
  stage: readonly string[];
}

declare const queryClient: KeyCache;

const keys = {
  all: ['applications'] as const,
  lists: () => [...keys.all, 'list'] as const,
  list: (filter: ApplicationListFilter) => [...keys.lists(), filter] as const,
};

export const listQuery = { queryKey: keys.list({ stage: ['applied'] }) };

queryClient.setQueryData(keys.all, []);

void queryClient.invalidateQueries({ queryKey: keys.all });
