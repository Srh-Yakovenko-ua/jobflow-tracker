import type { FeatureFlags } from '@/shared/config';

export const SILENCE_PRESETS = [3, 7, 14, 21] as const;

export const AUTO_GHOST_DEFAULT_DAYS = 30;

export const SETTINGS_SECTIONS = [
  'search',
  'notifications',
  'aiPrivacy',
  'appearance',
  'account',
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number];

const GATED_ITEMS = {
  notifyPush: 'browserPush',
  notifyEmail: 'emailNotifications',
  captureToken: 'captureToken',
  aiDataDeletion: 'aiDataDeletion',
  accountDeletion: 'accountDeletion',
} as const;

export type GatedSettingsItem = keyof typeof GATED_ITEMS;

export type SettingsItems = Readonly<Record<GatedSettingsItem, boolean>>;

export function visibleSettingsItems(flags: FeatureFlags): SettingsItems {
  return {
    notifyPush: flags[GATED_ITEMS.notifyPush],
    notifyEmail: flags[GATED_ITEMS.notifyEmail],
    captureToken: flags[GATED_ITEMS.captureToken],
    aiDataDeletion: flags[GATED_ITEMS.aiDataDeletion],
    accountDeletion: flags[GATED_ITEMS.accountDeletion],
  };
}

const LARGEST_PRESET = 21;

export function recommendedPreset(silenceDays: number): number {
  return SILENCE_PRESETS.find((preset) => preset >= silenceDays) ?? LARGEST_PRESET;
}
