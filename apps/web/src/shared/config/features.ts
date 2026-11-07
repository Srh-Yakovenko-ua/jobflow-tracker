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
  resumes: false,
  reminders: false,
  settings: true,
  addApplication: false,
  followUp: false,
  browserPush: false,
  emailNotifications: false,
  captureToken: false,
  aiDataDeletion: true,
  accountDeletion: false,
};
