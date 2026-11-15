import { describe, expect, it } from 'vitest';

import { FEATURE_FLAGS } from '@/shared/config';
import { EVERY_FLAG_ON } from '@/test/feature-flags';

import { recommendedPreset, visibleSettingsItems } from './settings-items';

describe('visibleSettingsItems', () => {
  it('shows browser push, the AI results deletion, the capture token and the account deletion and hides email while its backend is missing', () => {
    expect(visibleSettingsItems(FEATURE_FLAGS)).toEqual({
      notifyPush: true,
      notifyEmail: false,
      captureToken: true,
      aiDataDeletion: true,
      accountDeletion: true,
    });
  });

  it('shows each item once its own flag is on', () => {
    expect(visibleSettingsItems({ ...FEATURE_FLAGS, emailNotifications: true })).toEqual({
      notifyPush: true,
      notifyEmail: true,
      captureToken: true,
      aiDataDeletion: true,
      accountDeletion: true,
    });
    expect(Object.values(visibleSettingsItems(EVERY_FLAG_ON))).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
  });
});

describe('recommendedPreset', () => {
  it.each([
    [3, 3],
    [4, 7],
    [10, 14],
    [14, 14],
    [15, 21],
    [30, 21],
  ])('a suggested %i days points at the %i-day preset', (suggested, preset) => {
    expect(recommendedPreset(suggested)).toBe(preset);
  });
});
