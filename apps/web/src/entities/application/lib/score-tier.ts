import type { ApplicationCard } from '@jobflow/shared';

export const SCORE_TIER_FLOORS = { strong: 80, mid: 60 } as const;

export type ScoreTier = 'strong' | 'mid' | 'weak';

export type ScoreSource = Pick<ApplicationCard, 'matchScore' | 'aiStatus'>;

export type ScoreState =
  | { kind: 'queued' | 'processing' | 'failed' | 'none' }
  | { kind: 'score'; score: number; tier: ScoreTier };

export function scoreTierOf(score: number): ScoreTier {
  if (score >= SCORE_TIER_FLOORS.strong) {
    return 'strong';
  }
  return score >= SCORE_TIER_FLOORS.mid ? 'mid' : 'weak';
}

export function scoreStateOf({ matchScore, aiStatus }: ScoreSource): ScoreState {
  if (aiStatus !== null && aiStatus !== 'done') {
    return { kind: aiStatus };
  }
  if (matchScore === null) {
    return { kind: 'none' };
  }
  return { kind: 'score', score: matchScore, tier: scoreTierOf(matchScore) };
}
