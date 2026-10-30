import { type AiJobStatus, countedUk } from '@jobflow/shared';
import { CircleMinus } from 'lucide-react';
import type { ReactNode } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { formatDuration } from '@/shared/lib/state-format';

import { Button } from './button';
import { STATE_TEXT } from './state-text';
import { TOUCH_HEIGHT } from './touch-height';

const COPY = uk.states.async;

const PERCENT = 100;

type AiJobDetails = {
  queued: { ahead: number; etaSeconds: number };
  processing: { step: number; steps: number; etaSeconds?: number };
  done: { tookSeconds: number };
  failed: unknown;
};

export type AiJobOf<Status extends AiJobStatus> = Readonly<
  { status: Status } & AiJobDetails[Status]
>;

export type AiJob = { [Status in AiJobStatus]: AiJobOf<Status> }[AiJobStatus];

export type AsyncStateActions = { onRetry: () => void; onManual: () => void };

type JobLook<Status extends AiJobStatus> = {
  tone: string;
  marker: ReactNode;
  line: (job: AiJobOf<Status>) => string;
};

function Dot({ className }: Readonly<{ className: string }>) {
  return <span aria-hidden className={cn('size-2 flex-none rounded-pill', className)} />;
}

const WAITING_DOT = <Dot className="bg-accent motion-safe:animate-pulse" />;

function queuedLine(job: AiJobOf<'queued'>): string {
  const position =
    job.ahead > 0 ? COPY.ahead(countedUk(job.ahead, uk.states.forms.task)) : COPY.next;
  return COPY.queued(position, formatDuration(job.etaSeconds));
}

const LOOKS: { [Status in AiJobStatus]: JobLook<Status> } = {
  queued: { tone: 'text-link', marker: WAITING_DOT, line: queuedLine },
  processing: {
    tone: 'text-link',
    marker: WAITING_DOT,
    line: (job) => COPY.processing(job.step, job.steps),
  },
  done: {
    tone: 'text-offer',
    marker: <Dot className="bg-offer" />,
    line: (job) => COPY.done(formatDuration(job.tookSeconds)),
  },
  failed: {
    tone: 'text-danger',
    marker: <CircleMinus aria-hidden size={16} strokeWidth={1.9} className="flex-none" />,
    line: () => COPY.status.failed,
  },
};

function StatusLine<Status extends AiJobStatus>({ job }: Readonly<{ job: AiJobOf<Status> }>) {
  const look: JobLook<Status> = LOOKS[job.status];
  return (
    <p className={cn('label flex items-center gap-2.25 tabular-nums', look.tone)}>
      {look.marker}
      <span className="min-w-0">{look.line(job)}</span>
    </p>
  );
}

function ProcessingTrack({ job }: Readonly<{ job: AiJobOf<'processing'> }>) {
  const share = Math.min(job.step / job.steps, 1) * PERCENT;
  return (
    <>
      <span aria-hidden className="block h-1 bg-surface-3">
        <span className="block h-full bg-accent" style={{ width: `${String(share)}%` }} />
      </span>
      <span className={STATE_TEXT.meta}>
        {job.etaSeconds === undefined
          ? COPY.closable
          : COPY.closableIn(formatDuration(job.etaSeconds))}
      </span>
    </>
  );
}

function FailedFooter({ actions }: Readonly<{ actions?: AsyncStateActions | undefined }>) {
  return (
    <>
      <p className="body text-ink-2">{COPY.safe}</p>
      {actions && (
        <div className="flex flex-wrap gap-2.5">
          <Button className={TOUCH_HEIGHT} onClick={actions.onManual}>
            {COPY.manual}
          </Button>
          <Button variant="secondary" className={TOUCH_HEIGHT} onClick={actions.onRetry}>
            {COPY.retry}
          </Button>
        </div>
      )}
    </>
  );
}

export type AsyncStateProps = Readonly<{
  job: AiJob;
  actions?: AsyncStateActions;
  children?: ReactNode;
}>;

export function AsyncState({ job, actions, children }: AsyncStateProps) {
  return (
    <div role="status" className="flex min-w-0 flex-col gap-3.5 bg-surface p-5 shadow-e1">
      <StatusLine job={job} />
      {children}
      {job.status === 'processing' && <ProcessingTrack job={job} />}
      {job.status === 'failed' && <FailedFooter actions={actions} />}
    </div>
  );
}
