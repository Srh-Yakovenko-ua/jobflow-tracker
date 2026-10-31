import type { FeatureFlags } from '@/shared/config';

export const EVERY_FLAG_ON: FeatureFlags = {
  analytics: true,
  calendar: true,
  resumes: true,
  reminders: true,
  settings: true,
  addApplication: true,
  browserPush: true,
  emailNotifications: true,
  captureToken: true,
  aiDataDeletion: true,
  accountDeletion: true,
};
