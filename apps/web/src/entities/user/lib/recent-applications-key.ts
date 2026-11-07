import { logger } from '@/shared/lib/logger';

export function recentApplicationsKeyOf(userId: string): string {
  return `jobflow.recent-applications.${userId}`;
}

export function forgetRecentApplications(userId: string): void {
  try {
    localStorage.removeItem(recentApplicationsKeyOf(userId));
  } catch (error) {
    logger.warn({ err: error }, 'recent applications not forgotten');
  }
}
