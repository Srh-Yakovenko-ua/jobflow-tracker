'use client';

import { AI_JOB_STEPS, type ApplicationCard, type JobStatus } from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';

import { LIVE_CLIENT_LIMITS } from '@/shared/api';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { formatDuration } from '@/shared/lib/state-format';
import { FullCardBars } from '@/shared/ui/skeleton';
import { useSkeletonMotion } from '@/shared/ui/skeleton-motion';

import { jobQueryOptions } from '../api/job';
import { CARD_FRAME } from './card-frame';

const COPY = uk.application.parsing;

export type ParsingCardProps = Readonly<{
  parse: Pick<ApplicationCard, 'aiStatus' | 'aiJobId'>;
}>;

function QueueWait({ jobId }: Readonly<{ jobId: JobStatus['id'] }>) {
  const job = useQuery({
    ...jobQueryOptions(jobId),
    refetchInterval: LIVE_CLIENT_LIMITS.slowPollMs,
  });
  const eta = job.isSuccess ? job.data.queue?.etaSeconds : undefined;
  return eta === undefined ? COPY.queued : COPY.queuedEta(formatDuration(eta));
}

function ParsingLine({ parse }: ParsingCardProps) {
  if (parse.aiStatus !== 'queued') {
    return COPY.processing(AI_JOB_STEPS.processing, AI_JOB_STEPS.total);
  }
  return parse.aiJobId === null ? COPY.queued : <QueueWait jobId={parse.aiJobId} />;
}

export function ParsingCard({ parse }: ParsingCardProps) {
  const motion = useSkeletonMotion();
  return (
    <article className={cn(CARD_FRAME.article, 'gap-2.75 bg-surface text-ink shadow-e1')}>
      <p role="status" className={CARD_FRAME.eyebrow}>
        <span
          aria-hidden
          className={cn(CARD_FRAME.dot, motion === 'shimmer' && 'motion-safe:animate-pulse')}
        />
        <ParsingLine parse={parse} />
      </p>
      <FullCardBars motion={motion} />
    </article>
  );
}
