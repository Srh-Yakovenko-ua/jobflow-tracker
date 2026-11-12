'use client';

import { AI_JOB_STEPS, type ApplicationResponse, type JobStatus } from '@jobflow/shared';
import type { UseQueryResult } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { aiJobOf } from '@/entities/application';
import { type DraftReviewProps, reviewFieldsOf } from '@/features/edit-application';
import { isNotFound } from '@/shared/api';
import type { AiJob } from '@/shared/ui/async-state';

import { failureReasonOf } from '../model/failure-reason';
import { type Capture, type CaptureReads, useCapture } from '../model/use-capture';
import { IDLE_VIEW } from './add-explainer';
import type { CaptureFailureActions, CaptureFailureKind } from './capture-failure';
import {
  draftFormView,
  failureMarkOf,
  failureView,
  loadingView,
  progressView,
  readFailedView,
  readyView,
} from './capture-views';
import { LiveSection, type LiveView } from './live-section';

export type CaptureProgressActions = Pick<CaptureFailureActions, 'onRetried' | 'onDeleted'>;

export type CaptureProgressProps = Readonly<{ capture: Capture; actions: CaptureProgressActions }>;

type JobStage = Readonly<{ job: UseQueryResult<JobStatus>; jobId: JobStatus['id'] | null }>;

type ManualFill = 'closed' | 'open' | 'back';

type CardStage = Readonly<{
  reads: CaptureReads;
  manual: Readonly<{ fill: ManualFill; onBack: () => void }>;
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

function rereadView(query: UseQueryResult): LiveView {
  return readFailedView({
    onRetry: () => {
      void query.refetch();
    },
    retrying: query.isFetching,
  });
}

function jobView({ job, jobId }: JobStage): LiveView {
  if (job.data === undefined && job.errorUpdateCount > 0) return rereadView(job);
  const aiStatus = job.data?.status === 'processing' ? 'processing' : 'queued';
  return progressView({ job: aiJobOf(job.data), parse: { aiStatus, aiJobId: jobId } });
}

function unreadCardView({ reads }: CardStage): LiveView {
  const { application } = reads;
  if (isNotFound(application.error)) return IDLE_VIEW;
  if (application.errorUpdateCount > 0) return rereadView(application);
  return reads.owned?.status === 'done' ? READING_VIEW : loadingView();
}

function failureOf({ card, reads }: DraftStage): CaptureFailureKind | null {
  if (card.aiParsed !== null) {
    return reviewFieldsOf(card) === null ? { reason: 'generic', parsed: true } : null;
  }
  const job = reads.owned;
  if (job?.status !== 'failed') return null;
  return { reason: failureReasonOf(job.errorType), parsed: false };
}

function unfailedView({ card, reads, actions }: DraftStage): LiveView {
  if (card.aiParsed !== null) {
    return draftFormView({ id: 'review', mark: 'review', application: card, actions });
  }
  const rereading = reads.owned?.status === 'done' && reads.application.isFetching;
  return rereading ? READING_VIEW : IDLE_VIEW;
}

function draftView(stage: DraftStage): LiveView {
  const failure = failureOf(stage);
  if (failure === null) return unfailedView(stage);
  const { card, actions, manual } = stage;
  if (manual.fill !== 'open') {
    const view = { manualFocused: manual.fill === 'back' };
    return failureView({ application: card, failure, actions, view });
  }
  return draftFormView({
    id: 'manual',
    mark: failureMarkOf(failure),
    application: card,
    actions: { ...actions, onBack: manual.onBack },
  });
}

function cardView(stage: CardStage): LiveView {
  const card = stage.reads.application.data;
  if (card === undefined) return unreadCardView(stage);
  return card.isDraft ? draftView({ ...stage, card }) : readyView(card);
}

export function CaptureProgress({ capture, actions }: CaptureProgressProps) {
  const router = useRouter();
  const reads = useCapture(capture);
  const [fill, setFill] = useState<ManualFill>('closed');
  const stage: CardStage = {
    reads,
    manual: {
      fill,
      onBack: () => {
        setFill('back');
      },
    },
    actions: {
      ...actions,
      onManual: () => {
        setFill('open');
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
