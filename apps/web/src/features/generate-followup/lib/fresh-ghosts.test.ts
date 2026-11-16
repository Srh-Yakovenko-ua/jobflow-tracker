import { describe, expect, it } from 'vitest';

import { cardIn, fixtureIdOf, GHOSTED_CARDS } from '@/test/board-fixtures';

import { freshGhostsOf } from './fresh-ghosts';

describe('freshGhostsOf', () => {
  it('keeps ghosts at 10 and 44 days and leaves out 45, 60 and a draft', () => {
    expect(freshGhostsOf(GHOSTED_CARDS).map((card) => card.id)).toEqual([
      fixtureIdOf(201),
      fixtureIdOf(202),
    ]);
  });

  it('leaves out a fresh card that is not ghosted', () => {
    const applied = cardIn({ serial: 301, stage: 'applied', position: 'QA' });

    expect(freshGhostsOf([{ ...applied, daysSinceLastEvent: 2 }])).toEqual([]);
  });
});
