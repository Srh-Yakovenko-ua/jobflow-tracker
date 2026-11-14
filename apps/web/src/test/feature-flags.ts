import type * as SharedConfig from '@/shared/config';
import type { FeatureFlag, FeatureFlags } from '@/shared/config';

export const EVERY_FLAG_ON: FeatureFlags = {
  analytics: true,
  calendar: true,
  resumes: true,
  reminders: true,
  settings: true,
  addApplication: true,
  followUp: true,
  browserPush: true,
  emailNotifications: true,
  captureToken: true,
  aiDataDeletion: true,
  accountDeletion: true,
};

export const flagSwitch: { everyFlagOn: boolean; overrides: Partial<FeatureFlags> } = {
  everyFlagOn: false,
  overrides: {},
};

function isFlagOf(flags: FeatureFlags, key: string | symbol): key is FeatureFlag {
  return typeof key === 'string' && key in flags;
}

export function switchableFlags(shipped: FeatureFlags): FeatureFlags {
  return new Proxy(shipped, {
    get: (target, key) => {
      const flags = {
        ...(flagSwitch.everyFlagOn ? EVERY_FLAG_ON : target),
        ...flagSwitch.overrides,
      };
      return isFlagOf(flags, key) ? flags[key] : undefined;
    },
  });
}

export async function switchableConfig(
  importOriginal: () => Promise<typeof SharedConfig>,
): Promise<typeof SharedConfig> {
  const actual = await importOriginal();
  return { ...actual, FEATURE_FLAGS: switchableFlags(actual.FEATURE_FLAGS) };
}
