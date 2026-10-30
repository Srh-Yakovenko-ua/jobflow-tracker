export const FEATURES = [
  'analytics',
  'calendar',
  'resumes',
  'reminders',
  'settings',
  'addApplication',
] as const;

export type FeatureFlag = (typeof FEATURES)[number];

export type FeatureFlags = Readonly<Record<FeatureFlag, boolean>>;

export const FEATURE_FLAGS: FeatureFlags = {
  analytics: false,
  calendar: false,
  resumes: false,
  reminders: false,
  settings: false,
  addApplication: false,
};
