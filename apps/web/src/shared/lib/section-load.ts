import type { UseQueryResult } from '@tanstack/react-query';

export type FrameQuery = Pick<UseQueryResult, 'data' | 'isError' | 'isFetching' | 'refetch'>;

export type SectionQuery = FrameQuery & Pick<UseQueryResult, 'errorUpdateCount'>;

export type SectionLoad = Readonly<{
  pending: boolean;
  failed: boolean;
  stale: boolean;
  retrying: boolean;
  onRetry: () => void;
}>;

function failedOnce(query: SectionQuery): boolean {
  return (
    query.isError || (query.isFetching && query.data === undefined && query.errorUpdateCount > 0)
  );
}

export function sectionLoadOf(...queries: readonly SectionQuery[]): SectionLoad {
  const failed = queries.some((query) => failedOnce(query) && query.data === undefined);
  return {
    pending: !failed && queries.some((query) => query.data === undefined),
    failed,
    stale: queries.some((query) => query.isError && query.data !== undefined),
    retrying: queries.some((query) => failedOnce(query) && query.isFetching),
    onRetry: () => {
      queries.forEach((query) => void query.refetch());
    },
  };
}
