'use client';

import { type AiJob, AsyncState } from '@/shared/ui/async-state';
import { Button } from '@/shared/ui/button';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import type { AiRequestView } from '../lib/ai-result-view';

export type AiRequestCopy = Readonly<{
  idle: string;
  request: string;
  waiting: string;
  failed: Readonly<{ timeout: string; other: string }>;
}>;

export type AiRequest = Readonly<{ isPending: boolean; request: () => void }>;

export type AiRequestStateProps = Readonly<{
  view: AiRequestView;
  job: AiJob;
  requested: AiRequest;
  copy: AiRequestCopy;
}>;

export const AI_LEAD = 'text-[13px] leading-[1.55] text-ink-2';

const IN_SECTION = { className: 'bg-transparent p-0 shadow-none' };

const FAILED_JOB: AiJob = { status: 'failed' };

export function AiRequestState({ view, job, requested, copy }: AiRequestStateProps) {
  if (view.kind === 'waiting') {
    return (
      <AsyncState job={job} view={IN_SECTION}>
        <p className={AI_LEAD}>{copy.waiting}</p>
      </AsyncState>
    );
  }
  if (view.kind === 'failed') {
    return (
      <AsyncState
        job={FAILED_JOB}
        actions={{ onRetry: requested.request }}
        view={{ ...IN_SECTION, retrying: requested.isPending }}
      >
        <p className={AI_LEAD}>{view.timeout ? copy.failed.timeout : copy.failed.other}</p>
      </AsyncState>
    );
  }
  return (
    <div className="flex flex-col items-start gap-3">
      <p className={AI_LEAD}>{copy.idle}</p>
      <Button
        variant="secondary"
        loading={requested.isPending}
        className={TOUCH_HEIGHT}
        onClick={requested.request}
      >
        {copy.request}
      </Button>
    </div>
  );
}
