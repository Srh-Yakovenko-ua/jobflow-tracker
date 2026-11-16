import { describe, expect, it } from 'vitest';

import {
  EMAIL_SETTING_OF,
  EMAILED_TYPES,
  emailUnsubscribeInputSchema,
  emailUnsubscribeResponseSchema,
} from './email.js';
import { userSettingsPatchSchema, userSettingsSchema } from './schemas/user-settings.js';
import { issuePathsOf } from './test/zod-issues.js';

describe('EMAIL_SETTING_OF', () => {
  it.each(EMAILED_TYPES)('maps %s to a boolean settings field', (type) => {
    const settingKey = EMAIL_SETTING_OF[type];
    expect(Object.keys(userSettingsSchema.shape)).toContain(settingKey);
    expect(userSettingsPatchSchema.parse({ [settingKey]: false })).toStrictEqual({
      [settingKey]: false,
    });
  });

  it('gives each emailed type its own settings field', () => {
    expect(new Set(Object.values(EMAIL_SETTING_OF)).size).toBe(EMAILED_TYPES.length);
  });
});

describe('emailUnsubscribeInputSchema', () => {
  it('keeps a token at the 2048 character limit', () => {
    const token = 'a'.repeat(2048);
    expect(emailUnsubscribeInputSchema.parse({ token })).toStrictEqual({ token });
  });

  it.each([
    ['an empty token', ''],
    ['a token over 2048 characters', 'a'.repeat(2049)],
  ])('refuses %s', (_label, token) => {
    expect(issuePathsOf(emailUnsubscribeInputSchema.safeParse({ token }))).toEqual(['token']);
  });
});

describe('emailUnsubscribeResponseSchema', () => {
  it('refuses a notification type that never becomes an email', () => {
    expect(
      issuePathsOf(emailUnsubscribeResponseSchema.safeParse({ type: 'interview_soon' })),
    ).toEqual(['type']);
  });
});
