export const FEATURES = [
  'analytics',
  'calendar',
  'resumes',
  'reminders',
  'settings',
  'addApplication',
  'followUp',
  'browserPush',
  'emailNotifications',
  'captureToken',
  'aiDataDeletion',
  'accountDeletion',
  'weeklyRhythm',
] as const;

export type FeatureFlag = (typeof FEATURES)[number];

export type FeatureFlags = Readonly<Record<FeatureFlag, boolean>>;

export const FEATURE_FLAGS: FeatureFlags = {
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
  weeklyRhythm: true,
};
