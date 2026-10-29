import { describe, expect, it } from 'vitest';

import { scoreStateOf, scoreTierOf } from './score-tier';

describe('scoreTierOf', () => {
  it.each([
    [100, 'strong'],
    [80, 'strong'],
    [79, 'mid'],
    [60, 'mid'],
    [59, 'weak'],
    [0, 'weak'],
  ] as const)('puts a Match Score of %i in the %s tier', (score, tier) => {
    expect(scoreTierOf(score)).toBe(tier);
  });
});

describe('scoreStateOf', () => {
  it.each(['queued', 'processing', 'failed'] as const)(
    'a %s AI job wins over a stored score',
    (aiStatus) => {
      expect(scoreStateOf({ matchScore: 91, aiStatus })).toEqual({ kind: aiStatus });
    },
  );

  it('a finished job shows the stored score with its tier', () => {
    expect(scoreStateOf({ matchScore: 72, aiStatus: 'done' })).toEqual({
      kind: 'score',
      score: 72,
      tier: 'mid',
    });
  });

  it('a score of 0 stays a score, not the no-CV state', () => {
    expect(scoreStateOf({ matchScore: 0, aiStatus: null })).toEqual({
      kind: 'score',
      score: 0,
      tier: 'weak',
    });
  });

  it('no score and no AI job is the no-CV state', () => {
    expect(scoreStateOf({ matchScore: null, aiStatus: null })).toEqual({ kind: 'none' });
    expect(scoreStateOf({ matchScore: null, aiStatus: 'done' })).toEqual({ kind: 'none' });
  });
});
