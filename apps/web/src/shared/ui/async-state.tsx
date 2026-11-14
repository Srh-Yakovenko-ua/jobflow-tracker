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

export type AsyncStateActions = {
  onManual?: (() => void) | undefined;
  onRetry?: (() => void) | undefined;
  onDelete?: (() => void) | undefined;
};

export type AsyncStateView = {
  retrying?: boolean | undefined;
  manualFocused?: boolean | undefined;
  className?: string | undefined;
  label?: string | undefined;
};

type FailedFooterProps = Readonly<{
  actions?: AsyncStateActions | undefined;
  view?: AsyncStateView | undefined;
}>;

const DELETE_LOOK =
  'text-ink-3 not-disabled:hover:bg-surface-3 not-disabled:active:bg-surface-3 not-disabled:hover:text-ink not-disabled:active:text-ink';

type JobLook<Status extends AiJobStatus> = {
  tone: string;
  marker: ReactNode;
  line: (job: AiJobOf<Status>) => string;
};

function Dot({ className }: Readonly<{ className: string }>) {
  return <span aria-hidden className={cn('size-2 flex-none rounded-pill', className)} />;
}

export const WAITING_DOT = <Dot className="bg-accent motion-safe:animate-pulse" />;

export const DONE_DOT = <Dot className="bg-offer" />;

export const FAILED_MARK = (
  <CircleMinus aria-hidden size={16} strokeWidth={1.9} className="flex-none" />
);

function queuedLine(job: AiJobOf<'queued'>): string {
  const position =
    job.ahead > 0 ? COPY.ahead(countedUk(job.ahead, uk.states.forms.task)) : COPY.next;
  return COPY.queued(position, formatDuration(job.etaSeconds));
}

const LOOKS: { [Status in AiJobStatus]: JobLook<Status> } = {
  queued: { tone: 'label text-link', marker: WAITING_DOT, line: queuedLine },
  processing: {
    tone: 'label text-link',
    marker: WAITING_DOT,
    line: (job) => COPY.processing(job.step, job.steps),
  },
  done: {
    tone: 'label text-offer',
    marker: DONE_DOT,
    line: (job) => COPY.done(formatDuration(job.tookSeconds)),
  },
  failed: {
    tone: cn('font-ui text-danger', STATE_TEXT.eyebrow),
    marker: FAILED_MARK,
    line: () => COPY.status.failed,
  },
};

type StatusLineProps<Status extends AiJobStatus> = Readonly<{
  job: AiJobOf<Status>;
  label: string | undefined;
}>;

function StatusLine<Status extends AiJobStatus>({ job, label }: StatusLineProps<Status>) {
  const look: JobLook<Status> = LOOKS[job.status];
  const line = label !== undefined && job.status === 'processing' ? label : look.line(job);
  return (
    <p className={cn('flex items-center gap-2.25 tabular-nums', look.tone)}>
      {look.marker}
      <span className="min-w-0">{line}</span>
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

function FailedFooter({ actions, view }: FailedFooterProps) {
  return (
    <>
      <p className="body text-ink-2">{COPY.safe}</p>
      {actions && (
        <div className="flex flex-wrap gap-2.5">
          {actions.onManual && (
            <Button
              autoFocus={view?.manualFocused === true}
              className={TOUCH_HEIGHT}
              onClick={actions.onManual}
            >
              {COPY.manual}
            </Button>
          )}
          {actions.onRetry && (
            <Button
              variant="secondary"
              loading={view?.retrying === true}
              className={TOUCH_HEIGHT}
              onClick={actions.onRetry}
            >
              {COPY.retry}
            </Button>
          )}
          {actions.onDelete && (
            <Button
              variant="ghost"
              className={cn(TOUCH_HEIGHT, DELETE_LOOK)}
              onClick={actions.onDelete}
            >
              {COPY.delete}
            </Button>
          )}
        </div>
      )}
    </>
  );
}

export type AsyncStateProps = Readonly<{
  job: AiJob;
  actions?: AsyncStateActions;
  view?: AsyncStateView;
  children?: ReactNode;
}>;

export function AsyncState({ job, actions, view, children }: AsyncStateProps) {
  return (
    <div
      role="status"
      className={cn('flex min-w-0 flex-col gap-3.5 bg-surface p-5 shadow-e1', view?.className)}
    >
      <StatusLine job={job} label={view?.label} />
      {children}
      {job.status === 'processing' && <ProcessingTrack job={job} />}
      {job.status === 'failed' && <FailedFooter actions={actions} view={view} />}
    </div>
  );
}
