import { describe, expect, it } from 'vitest';

import { boardOf } from '@/test/board-fixtures';

import { silentCountOf } from './silent-count';

describe('silentCountOf', () => {
  it('adds the silent cards of every column', () => {
    expect(silentCountOf(boardOf({ applied: 2, screening: 1, tech_interview: 4 }))).toBe(7);
  });

  it('is 0 when no column holds a silent card', () => {
    expect(silentCountOf(boardOf({}))).toBe(0);
  });
});
