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
] as const;

export type FeatureFlag = (typeof FEATURES)[number];

export type FeatureFlags = Readonly<Record<FeatureFlag, boolean>>;

export const FEATURE_FLAGS: FeatureFlags = {
  analytics: false,
  calendar: true,
  resumes: true,
  reminders: false,
  settings: true,
  addApplication: true,
  followUp: false,
  browserPush: false,
  emailNotifications: false,
  captureToken: true,
  aiDataDeletion: true,
  accountDeletion: false,
};
