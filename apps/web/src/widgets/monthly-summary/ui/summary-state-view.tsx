'use client';

import type { Summary } from '@jobflow/shared';
import { AnimatePresence } from 'motion/react';
import type { ReactNode } from 'react';

import { RegenerateSummaryButton, useRegenerateSummary } from '@/features/regenerate-summary';
import { uk } from '@/shared/i18n';
import { AsyncState } from '@/shared/ui/async-state';
import { EmptyState } from '@/shared/ui/empty-state';
import { LoadFailedPanel } from '@/shared/ui/error-panel';
import { Fade } from '@/shared/ui/fade';
import { InlineAlert } from '@/shared/ui/inline-alert';
import { PageSkeleton } from '@/shared/ui/skeleton';

import type { SummaryState } from '../lib/summary-state';
import { SummaryBlock, type SummaryBlockView } from './summary-block';
import { SummaryGenerating } from './summary-generating';

const COPY = uk.summary;

function EmptySummary() {
  const { action, ...content } = COPY.empty;
  return (
    <EmptyState
      content={content}
      slots={{
        action: <RegenerateSummaryButton view={{ variant: 'primary', label: action }} />,
      }}
    />
  );
}

type FailedSummaryProps = Readonly<{ summary: Summary | null; view: SummaryBlockView }>;

function FailedSummary({ summary, view }: FailedSummaryProps) {
  const regenerate = useRegenerateSummary();
  return (
    <div className="flex min-w-0 flex-col gap-4.5">
      <AsyncState
        job={{ status: 'failed' }}
        actions={{ onRetry: regenerate.regenerate }}
        view={{ retrying: regenerate.isPending }}
      >
        <InlineAlert message={regenerate.refusal} />
      </AsyncState>
      {summary !== null && <SummaryBlock summary={summary} view={view} />}
    </div>
  );
}

export type SummaryStateViewProps = Readonly<{
  state: SummaryState;
  view: SummaryBlockView;
  onRetry: () => void;
}>;

function stateContent({ state, view, onRetry }: SummaryStateViewProps): ReactNode {
  switch (state.status) {
    case 'loading':
      return <PageSkeleton />;
    case 'load-failed':
      return <LoadFailedPanel onRetry={onRetry} />;
    case 'empty':
      return <EmptySummary />;
    case 'generating':
      return <SummaryGenerating job={state.job} />;
    case 'job-failed':
      return <FailedSummary summary={state.summary} view={view} />;
    case 'ready':
      return <SummaryBlock summary={state.summary} view={view} />;
    default: {
      const unhandled: never = state;
      throw new Error(`Unhandled summary state: ${JSON.stringify(unhandled)}`);
    }
  }
}

export function SummaryStateView(props: SummaryStateViewProps) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <Fade key={props.state.status} className="min-w-0">
        {stateContent(props)}
      </Fade>
    </AnimatePresence>
  );
}
