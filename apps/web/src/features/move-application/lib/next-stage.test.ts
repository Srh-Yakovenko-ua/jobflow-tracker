import type { OpenStage, Stage } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { nextStageOf } from './next-stage';

const NEXT_STAGE: readonly { stage: Stage; next: OpenStage | null }[] = [
  { stage: 'applied', next: 'screening' },
  { stage: 'screening', next: 'tech_interview' },
  { stage: 'tech_interview', next: 'final' },
  { stage: 'final', next: 'offer' },
  { stage: 'offer', next: null },
  { stage: 'rejected', next: null },
  { stage: 'ghosted', next: null },
  { stage: 'withdrawn', next: null },
];

describe('nextStageOf', () => {
  it.each(NEXT_STAGE)('a $stage card steps forward to $next', ({ stage, next }) => {
    expect(nextStageOf(stage)).toBe(next);
  });
});
