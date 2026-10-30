import { describe, expect, it } from 'vitest';

import { keyForReason, PICKED_SIDES, reasonForKey, reasonsOf } from './reason-order';

describe('reason order', () => {
  it('shows the company side first and each side in its sortOrder', () => {
    expect(PICKED_SIDES).toEqual(['company', 'candidate']);
    expect(reasonsOf('company')).toEqual([
      'skills_gap',
      'english_level',
      'salary_expectations',
      'chose_other',
      'position_closed',
      'no_explanation',
    ]);
    expect(reasonsOf('candidate')).toEqual([
      'low_salary',
      'office_schedule',
      'red_flags',
      'accepted_other',
    ]);
  });

  it.each([
    { code: 'skills_gap', key: '1' },
    { code: 'no_explanation', key: '6' },
    { code: 'low_salary', key: '7' },
    { code: 'red_flags', key: '9' },
    { code: 'accepted_other', key: '0' },
  ] as const)('$code sits on key $key and the key picks it back', ({ code, key }) => {
    expect(keyForReason(code)).toBe(key);
    expect(reasonForKey(key)).toBe(code);
  });

  it.each(['silence_timeout', 'unspecified'] as const)('%s has no key', (code) => {
    expect(keyForReason(code)).toBeUndefined();
  });

  it.each(['a', 'Enter', ' ', '10'])('key %j picks no reason', (key) => {
    expect(reasonForKey(key)).toBeUndefined();
  });
});
