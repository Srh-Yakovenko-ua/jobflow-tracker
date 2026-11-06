import type { UseQueryResult } from '@tanstack/react-query';

export type SectionLoad = Readonly<{ pending: boolean; failed: boolean; onRetry: () => void }>;

type LoadingQuery = Pick<UseQueryResult, 'data' | 'isError' | 'isFetching' | 'refetch'>;

export function sectionLoadOf(query: LoadingQuery): SectionLoad {
  const failed = query.isError && query.data === undefined && !query.isFetching;
  return {
    pending: query.data === undefined && !failed,
    failed,
    onRetry: () => {
      void query.refetch();
    },
  };
}
