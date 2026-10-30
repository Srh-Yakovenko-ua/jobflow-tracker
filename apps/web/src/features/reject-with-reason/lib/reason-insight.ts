import {
  REJECTION_REASONS,
  type RejectionReasonCode,
  type RejectionReasonsSummary,
  THRESHOLDS,
} from '@jobflow/shared';

type Reasons = RejectionReasonsSummary['reasons'];

export type ReasonClaim = Readonly<{ kind: 'pickedTop' | 'otherTop'; code: RejectionReasonCode }>;

export type ReasonInsight = Readonly<{
  total: number;
  claim: ReasonClaim | null;
  reasons: Reasons;
}>;

export type ReasonInsightInput = Readonly<{
  summary: RejectionReasonsSummary;
  picked: RejectionReasonCode;
}>;

function claimOf({ reasons, picked }: Readonly<{ reasons: Reasons; picked: RejectionReasonCode }>) {
  const top = Math.max(...reasons.map((reason) => reason.count));
  const leaders = reasons.filter((reason) => reason.count === top);
  const [leader] = leaders;
  if (leader === undefined || leaders.length > 1) return null;
  const kind = leader.code === picked ? 'pickedTop' : 'otherTop';
  return { kind, code: leader.code } satisfies ReasonClaim;
}

export function reasonInsightOf({ summary, picked }: ReasonInsightInput): ReasonInsight | null {
  const reasons = summary.reasons.filter(({ code }) => REJECTION_REASONS[code].side !== 'system');
  const stated = reasons.reduce((sum, reason) => sum + reason.count, 0);
  if (stated < THRESHOLDS.MIN_N_PERCENT) return null;
  return { total: stated, claim: claimOf({ reasons, picked }), reasons };
}
