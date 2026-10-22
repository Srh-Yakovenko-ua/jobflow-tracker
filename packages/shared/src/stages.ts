import { z } from 'zod';

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

export const TERMINAL_STAGES: readonly Stage[] = ['rejected', 'withdrawn'];

export const ACTIVE_STAGES: readonly Stage[] = ['applied', 'screening', 'tech_interview', 'final'];

export const ALLOWED_TRANSITIONS: Record<Stage, readonly Stage[]> = {
  applied: ['screening', 'tech_interview', 'rejected', 'ghosted', 'withdrawn'],
  screening: ['tech_interview', 'final', 'offer', 'rejected', 'ghosted', 'withdrawn'],
  tech_interview: ['tech_interview', 'final', 'offer', 'rejected', 'ghosted', 'withdrawn'],
  final: ['offer', 'rejected', 'ghosted', 'withdrawn'],
  offer: ['withdrawn'],
  rejected: [],
  ghosted: ACTIVE_STAGES,
  withdrawn: [],
};

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
