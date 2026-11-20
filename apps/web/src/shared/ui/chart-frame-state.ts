import { insufficientDataSchema } from '@jobflow/shared';

import { sectionLoadOf, type SectionQuery } from '@/shared/lib/section-load';

import type { ChartFrameState } from './chart-frame';

const READY: ChartFrameState = { status: 'ready' };

const LOADING: ChartFrameState = { status: 'loading' };

export function chartFrameStateOf(query: SectionQuery): ChartFrameState {
  if (query.data !== undefined) {
    const insufficient = insufficientDataSchema.safeParse(query.data);
    return insufficient.success ? insufficient.data : READY;
  }
  const load = sectionLoadOf(query);
  if (!load.failed) return LOADING;
  return { status: 'failed', retrying: load.retrying, onRetry: load.onRetry };
}
