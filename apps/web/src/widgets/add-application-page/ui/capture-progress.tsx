'use client';

import { AI_JOB_STEPS, type ApplicationResponse, type JobStatus } from '@jobflow/shared';
import type { UseQueryResult } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { type DraftReviewProps, reviewFieldsOf } from '@/features/edit-application';
import { ApiError } from '@/shared/api';
import type { AiJob } from '@/shared/ui/async-state';

import { failureReasonOf } from '../model/failure-reason';
import { type Capture, type CaptureReads, useCapture } from '../model/use-capture';
import { IDLE_VIEW } from './add-explainer';
import type { CaptureFailureActions, CaptureFailureKind } from './capture-failure';
import {
  draftFormView,
  failureMarkOf,
  failureView,
  progressView,
  readFailedView,
  readyView,
} from './capture-views';
import { LiveSection, type LiveView } from './live-section';

export type CaptureProgressActions = Pick<CaptureFailureActions, 'onRetried' | 'onDeleted'>;

export type CaptureProgressProps = Readonly<{ capture: Capture; actions: CaptureProgressActions }>;

type JobStage = Readonly<{ job: UseQueryResult<JobStatus>; jobId: JobStatus['id'] | null }>;

type CardStage = Readonly<{
  reads: CaptureReads;
  manual: boolean;
  actions: CaptureFailureActions & DraftReviewProps['actions'];
}>;

type DraftStage = CardStage & Readonly<{ card: ApplicationResponse }>;

const READING_CARD: AiJob = {
  status: 'processing',
  step: AI_JOB_STEPS.done,
  steps: AI_JOB_STEPS.total,
};

const READING_VIEW = progressView({
  job: READING_CARD,
  parse: { aiStatus: 'processing', aiJobId: null },
});

function isGone(error: Error): boolean {
  return error instanceof ApiError && error.status === 404;
}

function aiJobOf(job: JobStatus | undefined): AiJob {
  if (job?.status === 'queued' && job.queue !== null) {
    return { status: 'queued', ...job.queue };
  }
  return {
    status: 'processing',
    step: job?.step ?? AI_JOB_STEPS.queued,
    steps: AI_JOB_STEPS.total,
  };
}

function jobView({ job, jobId }: JobStage): LiveView {
  if (job.data === undefined && job.errorUpdateCount > 0) {
    return readFailedView(() => {
      void job.refetch();
    });
  }
  const aiStatus = job.data?.status === 'processing' ? 'processing' : 'queued';
  return progressView({ job: aiJobOf(job.data), parse: { aiStatus, aiJobId: jobId } });
}

function unreadCardView(application: UseQueryResult<ApplicationResponse>): LiveView {
  if (!application.isError) return READING_VIEW;
  if (isGone(application.error)) return IDLE_VIEW;
  return readFailedView(() => {
    void application.refetch();
  });
}

function failureOf({ card, reads }: DraftStage): CaptureFailureKind | null {
  if (card.aiParsed !== null) {
    return reviewFieldsOf(card) === null ? { reason: 'generic', parsed: true } : null;
  }
  const job = reads.job.data;
  if (job?.status !== 'failed') return null;
  return { reason: failureReasonOf(job.errorType), parsed: false };
}

function unfailedView({ card, reads, actions }: DraftStage): LiveView {
  if (card.aiParsed !== null) {
    return draftFormView({ id: 'review', mark: 'review', application: card, actions });
  }
  const rereading = reads.job.data?.status === 'done' && reads.application.isFetching;
  return rereading ? READING_VIEW : IDLE_VIEW;
}

function draftView(stage: DraftStage): LiveView {
  const failure = failureOf(stage);
  if (failure === null) return unfailedView(stage);
  const { card, actions } = stage;
  if (!stage.manual) return failureView({ application: card, failure, actions });
  return draftFormView({
    id: 'manual',
    mark: failureMarkOf(failure),
    application: card,
    actions,
  });
}

function cardView(stage: CardStage): LiveView {
  const card = stage.reads.application.data;
  if (card === undefined) return unreadCardView(stage.reads.application);
  return card.isDraft ? draftView({ ...stage, card }) : readyView(card);
}

export function CaptureProgress({ capture, actions }: CaptureProgressProps) {
  const router = useRouter();
  const reads = useCapture(capture);
  const [manual, setManual] = useState(false);
  const stage: CardStage = {
    reads,
    manual,
    actions: {
      ...actions,
      onManual: () => {
        setManual(true);
      },
      onConfirmed: () => {
        router.push('/board');
      },
    },
  };
  return (
    <LiveSection
      view={reads.settled ? cardView(stage) : jobView({ job: reads.job, jobId: capture.jobId })}
    />
  );
}
