import { type Stage, STAGES } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { canDragFrom, isLegalDrop } from './drop-rules';

const LEGAL_TARGETS: Record<Stage, readonly Stage[]> = {
  applied: ['screening', 'tech_interview', 'rejected', 'ghosted', 'withdrawn'],
  screening: ['tech_interview', 'final', 'offer', 'rejected', 'ghosted', 'withdrawn'],
  tech_interview: ['final', 'offer', 'rejected', 'ghosted', 'withdrawn'],
  final: ['offer', 'rejected', 'ghosted', 'withdrawn'],
  offer: ['withdrawn'],
  rejected: [],
  ghosted: ['applied', 'screening', 'tech_interview', 'final'],
  withdrawn: [],
};

const DROPS = STAGES.flatMap((from) =>
  STAGES.map((to) => ({ from, to, legal: LEGAL_TARGETS[from].includes(to) })),
);

describe('canDragFrom', () => {
  it.each([
    { stage: 'applied', draggable: true },
    { stage: 'screening', draggable: true },
    { stage: 'tech_interview', draggable: true },
    { stage: 'final', draggable: true },
    { stage: 'offer', draggable: true },
    { stage: 'rejected', draggable: false },
    { stage: 'ghosted', draggable: false },
    { stage: 'withdrawn', draggable: false },
  ] as const)('a $stage card can be picked up: $draggable', ({ stage, draggable }) => {
    expect(canDragFrom(stage)).toBe(draggable);
  });
});

describe('isLegalDrop', () => {
  it.each(DROPS)('a drop from $from onto $to is accepted: $legal', ({ from, to, legal }) => {
    expect(isLegalDrop({ from, to })).toBe(legal);
  });
});
