import { describe, expect, it } from 'vitest';

import { percentOf } from './percent';

describe('percentOf', () => {
  it.each([
    [0, 0],
    [0.124, 12],
    [0.125, 13],
    [1, 100],
  ])('a share of %d reads as %d percent', (fraction, percent) => {
    expect(percentOf(fraction)).toBe(percent);
  });
});
