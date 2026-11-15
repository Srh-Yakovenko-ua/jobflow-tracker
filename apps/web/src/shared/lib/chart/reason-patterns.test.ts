import { REJECTION_REASON_CODES, REJECTION_REASONS, REJECTION_SIDES } from '@jobflow/shared';
import { CHART_THEME } from '@jobflow/shared/chart-theme';
import { describe, expect, it } from 'vitest';

import { patternFill, REASON_PATTERNS } from './reason-patterns';

const { outcome, colors } = CHART_THEME.light;

describe('REASON_PATTERNS', () => {
  it.each(REJECTION_SIDES)('gives every %s reason a pattern of its own', (side) => {
    const patterns = REJECTION_REASON_CODES.filter(
      (code) => REJECTION_REASONS[code].side === side,
    ).map((code) => REASON_PATTERNS[code]);

    expect(new Set(patterns).size).toBe(patterns.length);
  });

  it('covers all 12 codes, the system ones included', () => {
    expect(new Set(Object.keys(REASON_PATTERNS))).toEqual(new Set(REJECTION_REASON_CODES));
    expect([REASON_PATTERNS.silence_timeout, REASON_PATTERNS.unspecified]).toEqual([
      'solid',
      'stripes',
    ]);
  });
});

describe('patternFill', () => {
  it.each(['stripes', 'solid'] as const)(
    'falls back to the plain colour for %s when the canvas has no 2d context',
    (pattern) => {
      expect(patternFill({ colour: outcome.rejected, pattern, ink: colors.surface })).toBe(
        outcome.rejected,
      );
    },
  );
});
