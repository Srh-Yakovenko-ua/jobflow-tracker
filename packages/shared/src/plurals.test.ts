import { describe, expect, it } from 'vitest';

import { APPLICATION_FORMS_UK, countedUk, DAY_FORMS_UK, pluralUk } from './plurals.js';

describe('countedUk', () => {
  it('writes 5 applications as 5 відгуків', () => {
    expect(countedUk(5, APPLICATION_FORMS_UK)).toBe('5 відгуків');
  });

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

describe('pluralUk', () => {
  it.for([
    [21, 'день'],
    [3, 'дні'],
    [14, 'днів'],
  ] as const)('gives %i days the word "%s" alone', ([count, expected]) => {
    expect(pluralUk(count, DAY_FORMS_UK)).toBe(expected);
  });

  it('a fractional 5.5 days reads дня', () => {
    expect(pluralUk(5.5, DAY_FORMS_UK)).toBe('дня');
  });
});
