import type { AiJobStatus } from '@jobflow/shared';

import type { Incident } from '@/shared/lib/incident';
import type { AiJobOf, AsyncStateActions } from '@/shared/ui/async-state';
import type { EmptyStateProgress } from '@/shared/ui/empty-state';
import type { AiQueueLoad, OversizedFile } from '@/shared/ui/error-panel';

import { SPECIMEN_CONTEXT } from './card-specimens';

const MEBIBYTE = 1024 * 1024;

export const STATE_TIME_ZONE = SPECIMEN_CONTEXT.timeZone;

export const ANALYTICS_PROGRESS: EmptyStateProgress = { count: 4, goal: 10 };

export const AI_JOBS: { [Status in AiJobStatus]: AiJobOf<Status> } = {
  queued: { status: 'queued', ahead: 2, etaSeconds: 30 },
  processing: { status: 'processing', step: 2, steps: 3, etaSeconds: 20 },
  done: { status: 'done', tookSeconds: 6 },
  failed: { status: 'failed' },
};

export function specimenNoop(): undefined {
  return undefined;
}

export const SPECIMEN_ACTIONS: AsyncStateActions = {
  onRetry: specimenNoop,
  onManual: specimenNoop,
};

export const OFFLINE_SYNCED_AT = new Date('2026-09-07T12:42:00Z');

export const AI_QUEUE_LOAD: AiQueueLoad = { queued: 47, etaMinutes: 4, waiting: 3 };

export const OVERSIZED_RESUME: OversizedFile = {
  sizeBytes: Math.round(8.4 * MEBIBYTE),
  limitBytes: 5 * MEBIBYTE,
};

export const CRASH_INCIDENT: Incident = {
  code: '5f3a',
  occurredAt: new Date('2026-09-07T13:04:00Z'),
};
