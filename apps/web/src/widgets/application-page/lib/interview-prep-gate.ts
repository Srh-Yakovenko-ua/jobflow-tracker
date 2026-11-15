import {
  ACTIVE_STAGES,
  type ApplicationMatchResponse,
  type ApplicationResponse,
  interviewPrepGapsOf,
  interviewPrepRequirementsOf,
  type Stage,
} from '@jobflow/shared';

type GateLoad = Readonly<{ pending: boolean; failed: boolean }>;

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

function materialOf({ application, match }: Omit<InterviewPrepGateInput, 'schedule'>) {
  if (interviewPrepRequirementsOf(application).length > 0) {
    return { settling: false, present: true };
  }
  const gaps = interviewPrepGapsOf(match.response?.match ?? null);
  return { settling: match.load.pending, present: match.load.failed || gaps.length > 0 };
}

export function interviewPrepGateOf({
  application,
  schedule,
  match,
}: InterviewPrepGateInput): InterviewPrepGate {
  const material = materialOf({ application, match });
  return {
    shown: schedule.upcoming || PREP_STAGES.includes(application.currentStage),
    settling: schedule.load.pending || material.settling,
    requestable: (schedule.upcoming || schedule.load.failed) && material.present,
  };
}
