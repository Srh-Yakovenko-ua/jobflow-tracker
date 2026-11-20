import {
  ACTIVE_STAGES,
  type ApplicationMatchResponse,
  type ApplicationResponse,
  interviewPrepGapsOf,
  interviewPrepRequirementsOf,
  type Stage,
} from '@jobflow/shared';

import type { SectionLoad } from '@/shared/lib/section-load';

type GateLoad = Pick<SectionLoad, 'pending' | 'failed' | 'retrying'>;

export type InterviewPrepGateInput = Readonly<{
  application: ApplicationResponse;
  schedule: Readonly<{ load: GateLoad; upcoming: boolean }>;
  match: Readonly<{ load: GateLoad; response: ApplicationMatchResponse | undefined }>;
}>;

export type InterviewPrepGate = Readonly<{
  shown: boolean;
  settling: boolean;
  requestable: boolean;
}>;

const PREP_STAGES: readonly Stage[] = ACTIVE_STAGES.filter((stage) => stage !== 'applied');

function settlingOf(load: GateLoad): boolean {
  return load.pending || load.retrying;
}

function materialOf({ application, match }: Omit<InterviewPrepGateInput, 'schedule'>) {
  if (interviewPrepRequirementsOf(application).length > 0) {
    return { settling: false, present: true };
  }
  const gaps = interviewPrepGapsOf(match.response?.match ?? null);
  return { settling: settlingOf(match.load), present: match.load.failed || gaps.length > 0 };
}

export function interviewPrepGateOf({
  application,
  schedule,
  match,
}: InterviewPrepGateInput): InterviewPrepGate {
  const material = materialOf({ application, match });
  return {
    shown: schedule.upcoming || PREP_STAGES.includes(application.currentStage),
    settling: settlingOf(schedule.load) || material.settling,
    requestable: (schedule.upcoming || schedule.load.failed) && material.present,
  };
}
