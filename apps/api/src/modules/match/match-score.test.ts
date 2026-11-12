import type { MatchOutput } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { MATCH_OUTPUT } from '../../test/ai.js';
import { scoreMatch } from './match-score.js';

const requirementsOf = (requirements: MatchOutput['requirements']): MatchOutput => ({
  ...MATCH_OUTPUT,
  requirements,
});

describe('scoreMatch', () => {
  it('takes the losses of each partial or missing requirement off 100 with must 3 and nice 1 points', () => {
    expect(scoreMatch(MATCH_OUTPUT)).toEqual({
      score: 59,
      matched: [
        { name: 'React + TypeScript', weight: 'must', coverage: 'full', pointsLost: 0 },
        { name: 'Node.js у проді', weight: 'must', coverage: 'full', pointsLost: 0 },
        { name: 'GraphQL', weight: 'nice', coverage: 'partial', pointsLost: 5 },
      ],
      missing: [
        { name: 'AWS / інфраструктура', weight: 'must', pointsLost: 27 },
        { name: 'Досвід ліда команди 3+', weight: 'nice', pointsLost: 9 },
      ],
      ignored: [{ name: 'Домен fintech', coverage: 'missing' }],
      explanation: 'Стек збігається, бракує AWS і досвіду ліда.',
    });
  });

  it('gives equal breakdowns for the same output scored twice', () => {
    expect(scoreMatch(MATCH_OUTPUT)).toEqual(scoreMatch(structuredClone(MATCH_OUTPUT)));
  });

  it('keeps the score and the missing list when the model lists the requirements in another order', () => {
    const permuted = scoreMatch(requirementsOf([...MATCH_OUTPUT.requirements].reverse()));

    expect(permuted?.score).toBe(59);
    expect(permuted?.missing.map(({ name }) => name)).toEqual([
      'AWS / інфраструктура',
      'Досвід ліда команди 3+',
    ]);
  });

  it('orders missing requirements of equal loss by name', () => {
    const scored = scoreMatch(
      requirementsOf([
        { name: 'Kafka', weight: 'nice', coverage: 'missing' },
        { name: 'Docker', weight: 'nice', coverage: 'missing' },
        { name: 'React', weight: 'must', coverage: 'full' },
      ]),
    );

    expect(scored?.missing).toEqual([
      { name: 'Docker', weight: 'nice', pointsLost: 20 },
      { name: 'Kafka', weight: 'nice', pointsLost: 20 },
    ]);
    expect(scored?.score).toBe(60);
  });

  it('never goes below 0 when the rounded losses add up past 100', () => {
    const scored = scoreMatch(
      requirementsOf([
        { name: 'Go', weight: 'must', coverage: 'missing' },
        { name: 'Kafka', weight: 'must', coverage: 'missing' },
        { name: 'Linux', weight: 'nice', coverage: 'missing' },
        { name: 'gRPC', weight: 'nice', coverage: 'missing' },
      ]),
    );

    expect(scored?.missing).toEqual([
      { name: 'Go', weight: 'must', pointsLost: 38 },
      { name: 'Kafka', weight: 'must', pointsLost: 38 },
      { name: 'gRPC', weight: 'nice', pointsLost: 13 },
      { name: 'Linux', weight: 'nice', pointsLost: 13 },
    ]);
    expect(scored?.score).toBe(0);
  });

  it('gives 100 when every weighed requirement is fully covered and only mentions are missing', () => {
    const scored = scoreMatch(
      requirementsOf([
        { name: 'React', weight: 'must', coverage: 'full' },
        { name: 'Домен fintech', weight: 'mentioned', coverage: 'missing' },
      ]),
    );

    expect(scored?.score).toBe(100);
    expect(scored?.missing).toEqual([]);
  });

  it('gives no score when the model found no must or nice requirement', () => {
    expect(
      scoreMatch(
        requirementsOf([{ name: 'Домен fintech', weight: 'mentioned', coverage: 'full' }]),
      ),
    ).toBeNull();
    expect(scoreMatch(requirementsOf([]))).toBeNull();
  });
});
