'use client';

import type { ApplicationResponse } from '@jobflow/shared';
import { useState } from 'react';

import { type RetryParseOptions, useRetryParse } from '@/features/add-application';
import { DeleteApplicationDialog } from '@/features/delete-application';
import { uk } from '@/shared/i18n';
import { useOpenerFocus } from '@/shared/lib/use-opener-focus';
import { type AiJob, AsyncState } from '@/shared/ui/async-state';

import type { FailureReason } from '../model/failure-reason';
import { LIVE_TITLE } from './live-section';

export type CaptureFailureKind = Readonly<{ reason: FailureReason; parsed: boolean }>;

export type CaptureFailureActions = RetryParseOptions['actions'] &
  Readonly<{ onManual: () => void; onDeleted: () => void }>;

export type CaptureFailureProps = Readonly<{
  application: ApplicationResponse;
  failure: CaptureFailureKind;
  actions: CaptureFailureActions;
  view?: { manualFocused?: boolean };
}>;

const COPY = uk.add.failed;

const FAILED_JOB: AiJob = { status: 'failed' };

function reasonOf({ reason, parsed }: CaptureFailureKind): string {
  const kept = parsed ? [] : [COPY.kept];
  return [COPY.reasons[reason], ...kept, COPY.next].join(' ');
}

function KeptText({ text }: Readonly<{ text: string }>) {
  return (
    <div className="max-w-[560px] rounded-md bg-surface-2 px-3.5 py-2.5 inset-ring inset-ring-line-soft">
      <blockquote className="line-clamp-3 text-[12px] leading-[1.5] font-semibold wrap-anywhere text-ink-3">
        {text}
      </blockquote>
    </div>
  );
}

export function CaptureFailure({ application, failure, actions, view }: CaptureFailureProps) {
  const [deleting, setDeleting] = useState(false);
  const retry = useRetryParse({ applicationId: application.id, actions });
  const openerFocus = useOpenerFocus();
  return (
    <>
      <AsyncState
        job={FAILED_JOB}
        actions={{
          onManual: actions.onManual,
          onDelete: () => {
            setDeleting(true);
          },
          ...(!failure.parsed && { onRetry: retry.retry }),
        }}
        view={{ manualFocused: view?.manualFocused, retrying: retry.isPending }}
      >
        <h3 className={LIVE_TITLE}>{COPY.title}</h3>
        <p className="max-w-[58ch] text-[15px] leading-[1.6] text-ink-2">{reasonOf(failure)}</p>
        {application.rawText !== null && <KeptText text={application.rawText} />}
      </AsyncState>
      <DeleteApplicationDialog
        application={deleting ? application : null}
        actions={{
          onCancel: () => {
            setDeleting(false);
          },
          onDeleted: actions.onDeleted,
        }}
        handlers={openerFocus}
      />
    </>
  );
}
