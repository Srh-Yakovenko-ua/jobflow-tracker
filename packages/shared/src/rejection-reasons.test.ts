import { describe, expect, it } from 'vitest';

import { REJECTION_REASONS } from './rejection-reasons.js';
import { THRESHOLDS } from './thresholds.js';

describe('REJECTION_REASONS', () => {
  it('groups the reason codes by the DOC-03 sides in sort order', () => {
    const ordered = Object.entries(REJECTION_REASONS)
      .sort(([, left], [, right]) => left.sortOrder - right.sortOrder)
      .map(([code, reason]) => [reason.sortOrder, code, reason.side]);
    expect(ordered).toEqual([
      [1, 'skills_gap', 'company'],
      [2, 'english_level', 'company'],
      [3, 'salary_expectations', 'company'],
      [4, 'chose_other', 'company'],
      [5, 'position_closed', 'company'],
      [6, 'no_explanation', 'company'],
      [7, 'low_salary', 'candidate'],
      [8, 'office_schedule', 'candidate'],
      [9, 'red_flags', 'candidate'],
      [10, 'accepted_other', 'candidate'],
      [11, 'silence_timeout', 'system'],
      [12, 'unspecified', 'system'],
    ]);
  });

  it('labels the unspecified reason with the design copy', () => {
    expect(REJECTION_REASONS.unspecified.labelUk).toBe('не хочу зараз вказувати');
  });
});

describe('THRESHOLDS', () => {
  it('keeps the DOC-09 minimum sample sizes, the 60% what-if conversion and the note topic floor of 3 notes and half of the noted rejections', () => {
    expect(THRESHOLDS).toEqual({
      MIN_N_PERCENT: 5,
      MIN_N_INSIGHT: 10,
      MIN_N_FORECAST: 15,
      WHAT_IF_CONVERSION: 0.6,
      MIN_N_NOTE_TOPIC: 3,
      MIN_SHARE_NOTE_TOPIC: 0.5,
    });
  });
});
