import { logger } from '@/shared/lib/logger';

const USER_STORAGE_NAMES = ['recent-applications', 'interview-prep', 'asked-topics'] as const;

export type UserStorageName = (typeof USER_STORAGE_NAMES)[number];

export type UserStorageKey = Readonly<{ name: UserStorageName; userId: string }>;

export function userStorageKeyOf({ name, userId }: UserStorageKey): string {
  return `jobflow.${name}.${userId}`;
}

export function forgetUserStorage(userId: string): void {
  try {
    for (const name of USER_STORAGE_NAMES) {
      localStorage.removeItem(userStorageKeyOf({ name, userId }));
    }
  } catch (error) {
    logger.warn({ err: error }, 'user storage not forgotten');
  }
}
