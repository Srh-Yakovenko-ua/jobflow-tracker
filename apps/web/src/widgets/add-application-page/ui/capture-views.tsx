'use client';

import { AI_JOB_STEPS, type ApplicationResponse } from '@jobflow/shared';
import Link from 'next/link';

import { ParsingCard, type ParsingCardProps, PreviewCard } from '@/entities/application';
import { DraftReview, type DraftReviewProps } from '@/features/edit-application';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { type AiJob, AsyncState } from '@/shared/ui/async-state';
import { buttonLinkClasses } from '@/shared/ui/button';
import { STATE_TEXT } from '@/shared/ui/state-text';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import { EXPLAINER_COPY } from './add-explainer';
import { LIVE_PANEL, LIVE_TITLE, type LiveView } from './live-section';

export type ProgressViewInput = Readonly<{ job: AiJob; parse: ParsingCardProps['parse'] }>;

const COPY = uk.add;

const STATE_PANEL = 'overflow-hidden rounded-lg shadow-e1';

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

export const FAILED_VIEW: LiveView = {
  id: 'failed',
  preview: null,
  panel: (
    <div className={STATE_PANEL}>
      <AsyncState job={{ status: 'failed' }} />
    </div>
  ),
};

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

export function reviewView({ application, actions }: DraftReviewProps): LiveView {
  return {
    id: 'review',
    preview: <PreviewCard application={application} />,
    panel: (
      <div className={cn(LIVE_PANEL, 'inset-ring inset-ring-accent/25')}>
        <DraftReview
          application={application}
          actions={actions}
          heading={
            <>
              <ParsedEyebrow />
              <h3 className={LIVE_TITLE}>{COPY.review.title}</h3>
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
