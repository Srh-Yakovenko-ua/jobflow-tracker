'use client';

import type { ApplicationResponse, CvHintsResponse } from '@jobflow/shared';
import { motion } from 'motion/react';

import { uk } from '@/shared/i18n';
import { type AiJob, AsyncState } from '@/shared/ui/async-state';
import { Button } from '@/shared/ui/button';
import { ROW } from '@/shared/ui/list-stagger';
import { Reveal } from '@/shared/ui/reveal';
import { StaggeredList } from '@/shared/ui/staggered-list';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import { type CvHintsResult, type CvHintsView, cvHintsViewOf } from '../lib/cv-hints-view';
import { type RequestedCvHints, useRequestCvHints } from '../model/use-request-cv-hints';
import { CvHintRow } from './cv-hint-row';

export type CvHintsPanelProps = Readonly<{
  application: ApplicationResponse;
  hints: Readonly<{ response: CvHintsResponse; job: AiJob }>;
}>;

type StateProps = Readonly<{ view: CvHintsView; job: AiJob; requested: RequestedCvHints }>;

const COPY = uk.cvHints;

const LEAD = 'text-[13px] leading-[1.55] text-ink-2';

const IN_SECTION = { className: 'bg-transparent p-0 shadow-none' };

const FAILED_JOB: AiJob = { status: 'failed' };

function GapList({ gaps }: Readonly<{ gaps: CvHintsResult['gaps'] }>) {
  return (
    <StaggeredList
      label={{ text: COPY.gapsTitle, marker: 'dashed' }}
      className="flex flex-col gap-2 text-[14px] leading-[1.45] text-ink-2"
    >
      {gaps.map((gap) => (
        <motion.li key={gap} variants={ROW} className="wrap-anywhere">
          {COPY.gap(gap)}
        </motion.li>
      ))}
    </StaggeredList>
  );
}

function ReadyState({ result }: Readonly<{ result: CvHintsResult }>) {
  const { hints, gaps } = result;
  return (
    <div className="flex flex-col gap-5">
      {hints.length === 0 ? (
        <p className={LEAD}>{COPY.empty}</p>
      ) : (
        <StaggeredList label={COPY.hintsLabel} className="flex flex-col gap-3">
          {hints.map((hint) => (
            <CvHintRow key={hint.requirement} hint={hint} />
          ))}
        </StaggeredList>
      )}
      {gaps.length > 0 && <GapList gaps={gaps} />}
    </div>
  );
}

function PanelState({ view, job, requested }: StateProps) {
  if (view.kind === 'ready') return <ReadyState result={view.result} />;
  if (view.kind === 'waiting') {
    return (
      <AsyncState job={job} view={IN_SECTION}>
        <p className={LEAD}>{COPY.waiting}</p>
      </AsyncState>
    );
  }
  if (view.kind === 'failed') {
    return (
      <AsyncState
        job={FAILED_JOB}
        actions={{ onRetry: requested.request }}
        view={{ ...IN_SECTION, retrying: requested.isPending }}
      >
        <p className={LEAD}>{view.timeout ? COPY.failed.timeout : COPY.failed.other}</p>
      </AsyncState>
    );
  }
  return (
    <div className="flex flex-col items-start gap-3">
      <p className={LEAD}>{COPY.idle}</p>
      <Button
        variant="secondary"
        loading={requested.isPending}
        className={TOUCH_HEIGHT}
        onClick={requested.request}
      >
        {COPY.request}
      </Button>
    </div>
  );
}

export function CvHintsPanel({ application, hints }: CvHintsPanelProps) {
  const requested = useRequestCvHints(application.id);
  const view = cvHintsViewOf({ response: hints.response, refused: requested.refused });
  return (
    <Reveal shown view={{ mode: 'wait', id: view.kind }}>
      <PanelState view={view} job={hints.job} requested={requested} />
    </Reveal>
  );
}
