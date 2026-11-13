import type { FrameQuery } from '@/shared/ui/chart-frame-state';

export type SectionLoad = Readonly<{ pending: boolean; failed: boolean; onRetry: () => void }>;

export function sectionLoadOf(query: FrameQuery): SectionLoad {
  const failed = query.isError && query.data === undefined && !query.isFetching;
  return {
    pending: query.data === undefined && !failed,
    failed,
    onRetry: () => {
      void query.refetch();
    },
  };
}
