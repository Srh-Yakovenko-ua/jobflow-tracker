import { describe, expect, it } from 'vitest';

import { countedUk, DAY_FORMS_UK } from './plurals.js';

describe('countedUk', () => {
  it.for([
    [0, '0 днів'],
    [1, '1 день'],
    [2, '2 дні'],
    [5, '5 днів'],
    [11, '11 днів'],
    [21, '21 день'],
    [22, '22 дні'],
  ] as const)('writes %i days as "%s" by the Ukrainian plural rule', ([count, expected]) => {
    expect(countedUk(count, DAY_FORMS_UK)).toBe(expected);
  });

  it('falls back to the other form when a form is missing', () => {
    expect(countedUk(1, { other: 'хв' })).toBe('1 хв');
  });
});
