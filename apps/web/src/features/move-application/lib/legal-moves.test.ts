import { describe, expect, it } from 'vitest';

import { legalMovesFrom } from './legal-moves';

describe('legalMovesFrom', () => {
  it.each([
    { from: 'applied', to: ['screening', 'tech_interview', 'rejected', 'ghosted', 'withdrawn'] },
    { from: 'tech_interview', to: ['final', 'offer', 'rejected', 'ghosted', 'withdrawn'] },
    { from: 'offer', to: ['withdrawn'] },
    { from: 'withdrawn', to: [] },
  ] as const)('from $from offers $to', ({ from, to }) => {
    expect(legalMovesFrom(from)).toEqual(to);
  });
});
