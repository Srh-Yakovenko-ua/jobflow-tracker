'use client';

import { AI_JOB_STEPS, type ApplicationResponse } from '@jobflow/shared';
import Link from 'next/link';

import {
  type DraftMark,
  ParsingCard,
  type ParsingCardProps,
  PreviewCard,
} from '@/entities/application';
import { DraftReview, type DraftReviewProps } from '@/features/edit-application';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { type AiJob, AsyncState } from '@/shared/ui/async-state';
import { buttonLinkClasses } from '@/shared/ui/button';
import { LoadFailedPanel } from '@/shared/ui/error-panel';
import { STATE_TEXT } from '@/shared/ui/state-text';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import { EXPLAINER_COPY } from './add-explainer';
import {
  CaptureFailure,
  type CaptureFailureKind,
  type CaptureFailureProps,
} from './capture-failure';
import { LIVE_PANEL, LIVE_TITLE, type LiveView } from './live-section';

export type ProgressViewInput = Readonly<{ job: AiJob; parse: ParsingCardProps['parse'] }>;

export type DraftFormKind = 'review' | 'manual';

export type DraftFormViewInput = Pick<DraftReviewProps, 'application' | 'actions'> &
  Readonly<{ id: DraftFormKind; mark: DraftMark }>;

type DraftFormLook = Readonly<{
  title: string;
  parsed: boolean;
  view: NonNullable<DraftReviewProps['view']>;
}>;

const COPY = uk.add;

const STATE_PANEL = 'overflow-hidden rounded-lg shadow-e1';

const DRAFT_FORM: Record<DraftFormKind, DraftFormLook> = {
  review: { title: COPY.review.title, parsed: true, view: {} },
  manual: {
    title: COPY.failed.manualTitle,
    parsed: false,
    view: { name: COPY.failed.manualTitle, focusField: 'company' },
  },
};

function linkClasses(variant: 'primary' | 'outline'): string {
  return cn(buttonLinkClasses({ variant, size: 'lg' }), TOUCH_HEIGHT);
}

function ParsedEyebrow() {
  return (
    <p className={cn('flex items-center gap-2.5 text-offer', STATE_TEXT.eyebrow)}>
      <span aria-hidden className="size-2 flex-none rounded-pill bg-offer" />
      {COPY.review.eyebrow(AI_JOB_STEPS.done, AI_JOB_STEPS.total)}
    </p>
  );
}

export function failureMarkOf({ parsed }: CaptureFailureKind): DraftMark {
  return parsed ? 'review' : 'failed';
}

export function progressView({ job, parse }: ProgressViewInput): LiveView {
  return {
    id: 'progress',
    preview: <ParsingCard parse={parse} />,
    panel: (
      <div className={STATE_PANEL}>
        <AsyncState job={job}>{EXPLAINER_COPY}</AsyncState>
      </div>
    ),
  };
}

export function readFailedView(onRetry: () => void): LiveView {
  return { id: 'read-failed', preview: null, panel: <LoadFailedPanel onRetry={onRetry} /> };
}

export function failureView(props: CaptureFailureProps): LiveView {
  return {
    id: 'failed',
    preview: (
      <PreviewCard application={props.application} view={{ mark: failureMarkOf(props.failure) }} />
    ),
    panel: (
      <div className={cn(STATE_PANEL, 'ring-1 ring-rejected')}>
        <CaptureFailure {...props} />
      </div>
    ),
  };
}

export function draftFormView({ id, mark, application, actions }: DraftFormViewInput): LiveView {
  const look = DRAFT_FORM[id];
  return {
    id,
    preview: <PreviewCard application={application} view={{ mark }} />,
    panel: (
      <div className={cn(LIVE_PANEL, 'inset-ring inset-ring-accent/25')}>
        <DraftReview
          application={application}
          actions={actions}
          view={look.view}
          heading={
            <>
              {look.parsed && <ParsedEyebrow />}
              <h3 className={LIVE_TITLE}>{look.title}</h3>
            </>
          }
        />
      </div>
    ),
  };
}

export function readyView(application: ApplicationResponse): LiveView {
  return {
    id: 'ready',
    preview: <PreviewCard application={application} />,
    panel: (
      <div className={cn(LIVE_PANEL, 'gap-4.5')}>
        <div className="flex flex-col gap-1.5">
          <ParsedEyebrow />
          <h3 className={LIVE_TITLE}>{COPY.ready.title}</h3>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/board" className={linkClasses('primary')}>
            {COPY.added.toBoard}
          </Link>
          <Link href={`/applications/${application.id}`} className={linkClasses('outline')}>
            {COPY.ready.toCard}
          </Link>
        </div>
      </div>
    ),
  };
}
