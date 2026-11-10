'use client';

import {
  AI_JOB_STEPS,
  type ApplicationResponse,
  type JobStatus,
  LIVE_LIMITS,
} from '@jobflow/shared';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { applicationQueryOptions, jobQueryOptions } from '@/entities/application';
import { type DraftReviewProps, reviewFieldsOf } from '@/features/edit-application';
import { ApiError, LIVE_CLIENT_LIMITS, useLiveConnected } from '@/shared/api';
import type { AiJob } from '@/shared/ui/async-state';

import { IDLE_VIEW } from './add-explainer';
import { FAILED_VIEW, progressView, readyView, reviewView } from './capture-views';
import { LiveSection, type LiveView } from './live-section';

export type Capture = Readonly<{
  applicationId: ApplicationResponse['id'];
  jobId: JobStatus['id'] | null;
}>;

export type CaptureProgressProps = Readonly<{ capture: Capture }>;

type JobStage = Readonly<{ job: UseQueryResult<JobStatus>; jobId: JobStatus['id'] | null }>;

type CardStage = Readonly<{
  application: UseQueryResult<ApplicationResponse>;
  actions: DraftReviewProps['actions'];
}>;

const READING_CARD: AiJob = {
  status: 'processing',
  step: AI_JOB_STEPS.done,
  steps: AI_JOB_STEPS.total,
};

function isRunning(job: JobStatus | undefined): boolean {
  return job?.status === 'queued' || job?.status === 'processing';
}

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
  if (job.isError || job.data?.status === 'failed') return FAILED_VIEW;
  const aiStatus = job.data?.status === 'processing' ? 'processing' : 'queued';
  return progressView({ job: aiJobOf(job.data), parse: { aiStatus, aiJobId: jobId } });
}

function cardView({ application, actions }: CardStage): LiveView {
  const card = application.data;
  if (card === undefined) {
    if (!application.isError) {
      return progressView({
        job: READING_CARD,
        parse: { aiStatus: 'processing', aiJobId: null },
      });
    }
    return isGone(application.error) ? IDLE_VIEW : FAILED_VIEW;
  }
  if (!card.isDraft) return readyView(card);
  if (card.aiParsed === null) return IDLE_VIEW;
  return reviewFieldsOf(card) === null ? FAILED_VIEW : reviewView({ application: card, actions });
}

export function CaptureProgress({ capture }: CaptureProgressProps) {
  const { applicationId, jobId } = capture;
  const router = useRouter();
  const connected = useLiveConnected();
  const job = useQuery({
    ...jobQueryOptions(jobId ?? ''),
    enabled: jobId !== null,
    refetchInterval: ({ state }) => {
      if (!isRunning(state.data)) return false;
      return connected ? LIVE_CLIENT_LIMITS.slowPollMs : LIVE_LIMITS.pollFallbackMs;
    },
  });
  const parsed = jobId === null || job.data?.status === 'done';
  const application = useQuery({ ...applicationQueryOptions(applicationId), enabled: parsed });
  const actions = {
    onConfirmed: () => {
      router.push('/board');
    },
  };
  return (
    <LiveSection view={parsed ? cardView({ application, actions }) : jobView({ job, jobId })} />
  );
}
