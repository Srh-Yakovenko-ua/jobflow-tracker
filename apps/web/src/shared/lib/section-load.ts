import type { UseQueryResult } from '@tanstack/react-query';

export type SectionQuery = Pick<
  UseQueryResult,
  'data' | 'isError' | 'isFetching' | 'refetch' | 'errorUpdateCount'
>;

export type SectionLoad = Readonly<{
  pending: boolean;
  busy: boolean;
  failed: boolean;
  stale: boolean;
  retrying: boolean;
  onRetry: () => void;
}>;

export type RetryLoad = Pick<SectionLoad, 'onRetry' | 'retrying'>;

function failedOnce(query: SectionQuery): boolean {
  return (
    query.isError || (query.isFetching && query.data === undefined && query.errorUpdateCount > 0)
  );
}

export function sectionLoadOf(...queries: readonly SectionQuery[]): SectionLoad {
  const failed = queries.some((query) => failedOnce(query) && query.data === undefined);
  const pending = !failed && queries.some((query) => query.data === undefined);
  const retrying = queries.some((query) => failedOnce(query) && query.isFetching);
  return {
    pending,
    busy: pending || retrying,
    failed,
    stale: queries.some((query) => query.isError && query.data !== undefined),
    retrying,
    onRetry: () => {
      queries.forEach((query) => void query.refetch());
    },
  };
}
