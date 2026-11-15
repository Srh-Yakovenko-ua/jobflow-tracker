'use client';

import type { ApplicationResponse, CvHintsResponse } from '@jobflow/shared';
import { motion } from 'motion/react';

import { AI_LEAD, AiRequestState } from '@/entities/application';
import { uk } from '@/shared/i18n';
import type { AiJob } from '@/shared/ui/async-state';
import { ROW } from '@/shared/ui/list-stagger';
import { Reveal } from '@/shared/ui/reveal';
import { StaggeredList } from '@/shared/ui/staggered-list';

import { type CvHintsResult, type CvHintsView, cvHintsViewOf } from '../lib/cv-hints-view';
import { type RequestedCvHints, useRequestCvHints } from '../model/use-request-cv-hints';
import { CvHintRow } from './cv-hint-row';

export type CvHintsPanelProps = Readonly<{
  application: ApplicationResponse;
  hints: Readonly<{ response: CvHintsResponse; job: AiJob }>;
}>;

type StateProps = Readonly<{ view: CvHintsView; job: AiJob; requested: RequestedCvHints }>;

const COPY = uk.cvHints;

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
        <p className={AI_LEAD}>{COPY.empty}</p>
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
  return <AiRequestState view={view} job={job} requested={requested} copy={COPY} />;
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
