import { describe, expect, it } from 'vitest';

import { searches } from './searches';

describe('search copy', () => {
  it.each([
    {
      counts: { days: 41, applications: 54, interviews: 9 },
      line: '41 день, 54 відгуки, 9 співбесід',
    },
    {
      counts: { days: 12, applications: 20, interviews: 3 },
      line: '12 днів, 20 відгуків, 3 співбесіди',
    },
    { counts: { days: 2, applications: 1, interviews: 1 }, line: '2 дні, 1 відгук, 1 співбесіда' },
  ])('stats reads $line', ({ counts, line }) => {
    expect(searches.stats(counts)).toBe(line);
  });

  it('the comparison names the previous search with its offer day, then the current one', () => {
    expect(
      searches.comparison({
        previous: { days: 41, applications: 54, interviews: 9, daysToOffer: 38 },
        current: { days: 12, applications: 20, interviews: 3 },
      }),
    ).toBe(
      'Минулий пошук: 41 день, 54 відгуки, 9 співбесід, офер на 38-й день · зараз: 12 днів, 20 відгуків, 3 співбесіди',
    );
  });

  it('a past search without an offer says so', () => {
    expect(searches.history.daysToOffer(null)).toBe('без оферу');
  });
});
