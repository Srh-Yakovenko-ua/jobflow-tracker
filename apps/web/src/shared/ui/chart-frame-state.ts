import { insufficientDataSchema } from '@jobflow/shared';

import type { FrameQuery } from '@/shared/lib/section-load';

import type { ChartFrameState } from './chart-frame';

const READY: ChartFrameState = { status: 'ready' };

const LOADING: ChartFrameState = { status: 'loading' };

export function chartFrameStateOf(query: FrameQuery): ChartFrameState {
  if (query.data !== undefined) {
    const insufficient = insufficientDataSchema.safeParse(query.data);
    return insufficient.success ? insufficient.data : READY;
  }
  if (!query.isError) return LOADING;
  return {
    status: 'failed',
    retrying: query.isFetching,
    onRetry: () => {
      void query.refetch();
    },
  };
}
