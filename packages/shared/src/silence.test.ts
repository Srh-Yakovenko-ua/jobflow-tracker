import { describe, expect, it } from 'vitest';

import {
  effectiveSilenceDays,
  type SilenceLevel,
  silenceLevelOf,
  wholeDaysBetween,
} from './silence.js';
import type { Stage } from './stages.js';

const SILENCE_ROWS: readonly (readonly [Stage, number, SilenceLevel])[] = [
  ['applied', 3, 'none'],
  ['applied', 4, 'warn'],
  ['applied', 6, 'warn'],
  ['applied', 7, 'silent'],
  ['screening', 9, 'silent'],
  ['tech_interview', 4, 'warn'],
  ['final', 6, 'none'],
  ['final', 7, 'warn'],
  ['final', 13, 'warn'],
  ['final', 14, 'silent'],
  ['offer', 30, 'none'],
  ['rejected', 30, 'none'],
  ['ghosted', 30, 'none'],
  ['withdrawn', 30, 'none'],
];

describe('silenceLevelOf', () => {
  it.for(SILENCE_ROWS)(
    'answers %s after %i silent days with silenceDays 7 as %s',
    ([stage, daysSinceLastEvent, expected]) => {
      expect(silenceLevelOf({ stage, silenceDays: 7, daysSinceLastEvent })).toBe(expected);
    },
  );
});

describe('effectiveSilenceDays', () => {
  it('doubles the threshold on final', () => {
    expect(effectiveSilenceDays({ silenceDays: 7 }, 'final')).toBe(14);
  });

  it('keeps the setting on an earlier stage', () => {
    expect(effectiveSilenceDays({ silenceDays: 10 }, 'screening')).toBe(10);
  });
});

describe('wholeDaysBetween', () => {
  const from = new Date('2026-10-01T09:00:00.000Z');

  it('counts 3 days 23 hours as 3 whole days', () => {
    expect(wholeDaysBetween(from, new Date('2026-10-05T08:00:00.000Z'))).toBe(3);
  });

  it('counts exactly 8 days as 8', () => {
    expect(wholeDaysBetween(from, new Date('2026-10-09T09:00:00.000Z'))).toBe(8);
  });

  it('clamps an instant in the future to 0', () => {
    expect(wholeDaysBetween(from, new Date('2026-09-28T09:00:00.000Z'))).toBe(0);
  });
});
