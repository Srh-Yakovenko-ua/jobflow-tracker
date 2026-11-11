'use client';

import { AI_JOB_STEPS, type ApplicationCard, type JobStatus } from '@jobflow/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { LIVE_CLIENT_LIMITS } from '@/shared/api';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { formatDuration } from '@/shared/lib/state-format';
import { FullCardBars } from '@/shared/ui/skeleton';
import { useSkeletonMotion } from '@/shared/ui/skeleton-motion';

import { jobQueryOptions } from '../api/job';
import { jobFinished } from '../lib/job-finished';
import { applicationKeys } from '../model/keys';
import { CARD_FRAME } from './card-frame';

const COPY = uk.application.parsing;

const PROCESSING_LINE = COPY.processing(AI_JOB_STEPS.processing, AI_JOB_STEPS.total);

export type ParsingCardProps = Readonly<{
  parse: Pick<ApplicationCard, 'aiStatus' | 'aiJobId'>;
  view?: Readonly<{ ordinal: number }> | undefined;
}>;

function QueueWait({ jobId }: Readonly<{ jobId: JobStatus['id'] }>) {
  const queryClient = useQueryClient();
  const job = useQuery({
    ...jobQueryOptions(jobId),
    refetchInterval: ({ state }) =>
      jobFinished(state.data) ? false : LIVE_CLIENT_LIMITS.slowPollMs,
  });
  const finished = jobFinished(job.data);
  useEffect(() => {
    if (finished) void queryClient.invalidateQueries({ queryKey: applicationKeys.boards() });
  }, [finished, queryClient]);
  if (!job.isSuccess) return COPY.queued;
  if (finished || job.data.status === 'processing') return PROCESSING_LINE;
  const eta = job.data.queue?.etaSeconds;
  return eta === undefined ? COPY.queued : COPY.queuedEta(formatDuration(eta));
}

function ParsingLine({ parse }: Pick<ParsingCardProps, 'parse'>) {
  if (parse.aiStatus !== 'queued') return PROCESSING_LINE;
  return parse.aiJobId === null ? COPY.queued : <QueueWait jobId={parse.aiJobId} />;
}

export function ParsingCard({ parse, view }: ParsingCardProps) {
  const motion = useSkeletonMotion();
  return (
    <article className={cn(CARD_FRAME.article, 'gap-2.75 bg-surface text-ink shadow-e1')}>
      <p className={CARD_FRAME.eyebrow}>
        <span
          aria-hidden
          className={cn(CARD_FRAME.dot, motion === 'shimmer' && 'motion-safe:animate-pulse')}
        />
        {view !== undefined && (
          <>
            <span className="sr-only">{COPY.ordinal(view.ordinal)}</span>{' '}
          </>
        )}
        <ParsingLine parse={parse} />
      </p>
      <FullCardBars motion={motion} />
    </article>
  );
}
