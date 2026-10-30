import type { RejectionReasonCode, RejectionReasonsSummary } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { type ReasonInsight, reasonInsightOf } from './reason-insight';

type Reasons = RejectionReasonsSummary['reasons'];

type InsightCase = {
  name: string;
  reasons: Reasons;
  picked: RejectionReasonCode;
  insight: ReasonInsight | null;
};

const SKILLS_ON_TOP: Reasons = [
  { code: 'skills_gap', count: 3 },
  { code: 'chose_other', count: 2 },
];

const TIED_ON_TOP: Reasons = [
  { code: 'skills_gap', count: 2 },
  { code: 'chose_other', count: 2 },
  { code: 'low_salary', count: 1 },
];

function summaryOf(reasons: Reasons): RejectionReasonsSummary {
  const total = reasons.reduce((sum, reason) => sum + reason.count, 0);
  return { stage: 'tech_interview', total, reasons };
}

const CASES: readonly InsightCase[] = [
  {
    name: '2 stated reasons give only the recorded note',
    reasons: [{ code: 'skills_gap', count: 2 }],
    picked: 'skills_gap',
    insight: null,
  },
  {
    name: '4 stated reasons give only the recorded note',
    reasons: [
      { code: 'skills_gap', count: 3 },
      { code: 'chose_other', count: 1 },
    ],
    picked: 'skills_gap',
    insight: null,
  },
  {
    name: '5 with the picked reason alone on top say it became the most frequent',
    reasons: SKILLS_ON_TOP,
    picked: 'skills_gap',
    insight: {
      total: 5,
      claim: { kind: 'pickedTop', code: 'skills_gap' },
      reasons: SKILLS_ON_TOP,
    },
  },
  {
    name: '5 with another reason alone on top name that one',
    reasons: SKILLS_ON_TOP,
    picked: 'chose_other',
    insight: { total: 5, claim: { kind: 'otherTop', code: 'skills_gap' }, reasons: SKILLS_ON_TOP },
  },
  {
    name: '5 with a tie on top make no claim but keep the count and the bar',
    reasons: TIED_ON_TOP,
    picked: 'skills_gap',
    insight: { total: 5, claim: null, reasons: TIED_ON_TOP },
  },
  {
    name: '6 unspecified and 1 skills_gap give only the recorded note',
    reasons: [
      { code: 'unspecified', count: 6 },
      { code: 'skills_gap', count: 1 },
    ],
    picked: 'skills_gap',
    insight: null,
  },
  {
    name: 'unspecified stays out of the count, the bar and the claim, so the count is the sum of the bar',
    reasons: [
      { code: 'skills_gap', count: 3 },
      { code: 'unspecified', count: 2 },
      { code: 'red_flags', count: 2 },
    ],
    picked: 'unspecified',
    insight: {
      total: 5,
      claim: { kind: 'otherTop', code: 'skills_gap' },
      reasons: [
        { code: 'skills_gap', count: 3 },
        { code: 'red_flags', count: 2 },
      ],
    },
  },
];

describe('reasonInsightOf', () => {
  it.each(CASES)('$name', ({ reasons, picked, insight }) => {
    expect(reasonInsightOf({ summary: summaryOf(reasons), picked })).toEqual(insight);
  });
});
