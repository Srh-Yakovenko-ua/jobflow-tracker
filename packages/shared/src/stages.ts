import { z } from 'zod';

import type { LocalizedLabel } from './labels.js';

export const STAGES = [
  'applied',
  'screening',
  'tech_interview',
  'final',
  'offer',
  'rejected',
  'ghosted',
  'withdrawn',
] as const;

export const stageSchema = z.enum(STAGES);

export type Stage = z.infer<typeof stageSchema>;

export const STAGE_LABELS: Record<Stage, LocalizedLabel> = {
  applied: { labelUk: 'відгук', labelEn: 'Applied' },
  screening: { labelUk: 'скринінг', labelEn: 'Screening' },
  tech_interview: { labelUk: "техінтерв'ю", labelEn: 'Tech interview' },
  final: { labelUk: 'фінал', labelEn: 'Final' },
  offer: { labelUk: 'офер', labelEn: 'Offer' },
  rejected: { labelUk: 'відмова', labelEn: 'Rejected' },
  ghosted: { labelUk: 'ghosted', labelEn: 'Ghosted' },
  withdrawn: { labelUk: 'відкликав', labelEn: 'Withdrawn' },
};

export const TERMINAL_STAGES: readonly Stage[] = ['rejected', 'withdrawn'];

export const ACTIVE_STAGES = [
  'applied',
  'screening',
  'tech_interview',
  'final',
] as const satisfies readonly Stage[];

export type ActiveStage = (typeof ACTIVE_STAGES)[number];

const ACTIVE_STAGE_LIST: readonly Stage[] = ACTIVE_STAGES;

export function isActiveStage(stage: Stage): stage is ActiveStage {
  return ACTIVE_STAGE_LIST.includes(stage);
}

export type InactiveStage = Exclude<Stage, ActiveStage>;

export const INACTIVE_STAGES: readonly InactiveStage[] = STAGES.filter(
  (stage): stage is InactiveStage => !isActiveStage(stage),
);

export const OUTCOME_STAGES = [
  'rejected',
  'ghosted',
  'withdrawn',
] as const satisfies readonly Stage[];

export const outcomeStageSchema = z.enum(OUTCOME_STAGES);

export type OutcomeStage = z.infer<typeof outcomeStageSchema>;

export type OpenStage = Exclude<Stage, OutcomeStage>;

const OUTCOME_STAGE_LIST: readonly Stage[] = OUTCOME_STAGES;

export const OPEN_STAGES: readonly OpenStage[] = STAGES.filter(
  (stage): stage is OpenStage => !OUTCOME_STAGE_LIST.includes(stage),
);

export const ALLOWED_TRANSITIONS: Record<Stage, readonly Stage[]> = {
  applied: ['screening', 'tech_interview', ...OUTCOME_STAGES],
  screening: ['tech_interview', 'final', 'offer', ...OUTCOME_STAGES],
  tech_interview: ['tech_interview', 'final', 'offer', ...OUTCOME_STAGES],
  final: ['offer', ...OUTCOME_STAGES],
  offer: ['withdrawn'],
  rejected: [],
  ghosted: ACTIVE_STAGES,
  withdrawn: [],
};

const NON_REPLY_STAGES: readonly Stage[] = ['ghosted', 'withdrawn'];

export function isReplyStage(stage: Stage) {
  return !NON_REPLY_STAGES.includes(stage);
}

export const RESPONSE_STAGES: readonly Stage[] = ALLOWED_TRANSITIONS.applied.filter(isReplyStage);

export const TRANSITION_REFUSAL_REASONS = ['terminal_stage', 'not_allowed'] as const;

export type TransitionRefusalReason = (typeof TRANSITION_REFUSAL_REASONS)[number];

export type TransitionResult = { ok: true } | { ok: false; reason: TransitionRefusalReason };

export function canTransition(from: Stage, to: Stage): TransitionResult {
  if (TERMINAL_STAGES.includes(from)) {
    return { ok: false, reason: 'terminal_stage' };
  }
  if (ALLOWED_TRANSITIONS[from].includes(to)) {
    return { ok: true };
  }
  return { ok: false, reason: 'not_allowed' };
}
