import { countedUk } from '@jobflow/shared';
import type { ReactNode } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { formatClock, formatMegabytes } from '@/shared/lib/state-format';

import { Button } from './button';
import { STATE_TEXT } from './state-text';
import { TOUCH_HEIGHT } from './touch-height';

const COPY = uk.states.errors;

const FORMS = uk.states.forms;

export type ErrorPanelContent = { eyebrow: string; title: string; body: string };

export type ErrorPanelProps = Readonly<{
  content: ErrorPanelContent;
  meta?: ReactNode;
  action?: ReactNode;
}>;

export function ErrorPanel({ content, meta, action }: ErrorPanelProps) {
  return (
    <div
      role="alert"
      className="flex min-w-0 flex-col items-start gap-3 bg-surface p-5.5 shadow-e1 inset-shadow-[3px_0_0_var(--color-rejected)]"
    >
      <span className={cn(STATE_TEXT.eyebrow, 'text-danger')}>{content.eyebrow}</span>
      <p className="text-[16px] leading-[1.35] font-semibold text-ink">{content.title}</p>
      <p className="text-[14px] leading-[1.55] text-ink-2">{content.body}</p>
      {meta}
      {action}
    </div>
  );
}

type RetryPanelProps = Readonly<{
  content: ErrorPanelContent;
  retry: { label: string; onRetry: () => void };
}>;

function RetryPanel({ content, retry }: RetryPanelProps) {
  return (
    <ErrorPanel
      content={content}
      action={
        <Button variant="secondary" className={TOUCH_HEIGHT} onClick={retry.onRetry}>
          {retry.label}
        </Button>
      }
    />
  );
}

export type OfflinePanelProps = Readonly<{
  lastSyncedAt: Date;
  timeZone?: string | undefined;
  onRetry: () => void;
}>;

export function OfflinePanel({ lastSyncedAt, timeZone, onRetry }: OfflinePanelProps) {
  const { body, action, ...heading } = COPY.offline;
  const content = { ...heading, body: body(formatClock({ at: lastSyncedAt, timeZone })) };
  return <RetryPanel content={content} retry={{ label: action, onRetry }} />;
}

export type AiQueueLoad = { queued: number; etaMinutes: number; waiting: number };

export type AiQueuePanelProps = Readonly<{ queue: AiQueueLoad }>;

export function AiQueuePanel({ queue }: AiQueuePanelProps) {
  const { body, ...heading } = COPY.aiQueue;
  const tasks = countedUk(queue.queued, FORMS.task);
  const content = { ...heading, body: body(tasks, countedUk(queue.etaMinutes, FORMS.minute)) };
  return (
    <ErrorPanel
      content={content}
      meta={
        <span className={cn(STATE_TEXT.meta, 'flex items-center gap-2.25')}>
          <span aria-hidden className="size-1.75 flex-none rounded-pill bg-stage-final" />
          {countedUk(queue.waiting, FORMS.cardsWaiting)}
        </span>
      }
    />
  );
}

export type OversizedFile = { sizeBytes: number; limitBytes: number };

export type FileTooBigPanelProps = Readonly<{ file: OversizedFile; onPick: () => void }>;

export function FileTooBigPanel({ file, onPick }: FileTooBigPanelProps) {
  const { eyebrow, title, body, action } = COPY.fileTooBig;
  const content = {
    eyebrow,
    title: title(formatMegabytes(file.sizeBytes)),
    body: body(formatMegabytes(file.limitBytes)),
  };
  return (
    <ErrorPanel
      content={content}
      action={
        <Button className={TOUCH_HEIGHT} onClick={onPick}>
          {action}
        </Button>
      }
    />
  );
}

export type LoadFailedPanelProps = Readonly<{ onRetry: () => void }>;

export function LoadFailedPanel({ onRetry }: LoadFailedPanelProps) {
  const { action, ...content } = COPY.loadFailed;
  return <RetryPanel content={content} retry={{ label: action, onRetry }} />;
}
