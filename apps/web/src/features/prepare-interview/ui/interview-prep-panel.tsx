'use client';

import type { ApplicationResponse, InterviewPrepResponse } from '@jobflow/shared';

import { AI_LEAD, AiRequestState } from '@/entities/application';
import { uk } from '@/shared/i18n';
import type { AiJob } from '@/shared/ui/async-state';
import { Reveal } from '@/shared/ui/reveal';

import { type InterviewPrepView, interviewPrepViewOf } from '../lib/interview-prep-view';
import {
  type RequestedInterviewPrep,
  useRequestInterviewPrep,
} from '../model/use-request-interview-prep';
import { InterviewPrepPack } from './interview-prep-pack';

export type InterviewPrepPanelProps = Readonly<{
  application: ApplicationResponse;
  prep: Readonly<{ response: InterviewPrepResponse; job: AiJob }>;
}>;

type StateProps = Readonly<{
  view: InterviewPrepView;
  job: AiJob;
  requested: RequestedInterviewPrep;
}>;

const COPY = uk.interviewPrep;

function PanelState({ view, job, requested }: StateProps) {
  if (view.kind === 'ready') return <InterviewPrepPack result={view.result} />;
  if (view.kind === 'unbuildable') return <p className={AI_LEAD}>{COPY.unbuildable}</p>;
  return <AiRequestState view={view} job={job} requested={requested} copy={COPY} />;
}

export function InterviewPrepPanel({ application, prep }: InterviewPrepPanelProps) {
  const requested = useRequestInterviewPrep(application.id);
  const view = interviewPrepViewOf({ response: prep.response, refusal: requested.refusal });
  return (
    <Reveal shown view={{ mode: 'wait', id: view.kind }}>
      <PanelState view={view} job={prep.job} requested={requested} />
    </Reveal>
  );
}
