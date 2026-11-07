import { applicationResponseSchema } from '@jobflow/shared';
import type { z } from 'zod';

import { logger } from '@/shared/lib/logger';

const recentApplicationSchema = applicationResponseSchema.pick({
  id: true,
  company: true,
  position: true,
});

const recentListSchema = recentApplicationSchema.array();

export type RecentApplication = z.infer<typeof recentApplicationSchema>;

export type RememberedApplication = Readonly<{ userId: string; application: RecentApplication }>;

const RECENT_LIMIT = 5;

function storageKeyOf(userId: string): string {
  return `jobflow.recent-applications.${userId}`;
}

export function readRecentApplications(userId: string): RecentApplication[] {
  try {
    const stored = localStorage.getItem(storageKeyOf(userId));
    if (stored === null) return [];
    const parsed = recentListSchema.safeParse(JSON.parse(stored));
    return parsed.success ? parsed.data.slice(0, RECENT_LIMIT) : [];
  } catch (error) {
    logger.warn({ err: error }, 'recent applications unreadable');
    return [];
  }
}

export function rememberRecentApplication({ userId, application }: RememberedApplication): void {
  const { id, company, position } = application;
  const others = readRecentApplications(userId).filter((recent) => recent.id !== id);
  const recent = [{ id, company, position }, ...others].slice(0, RECENT_LIMIT);
  try {
    localStorage.setItem(storageKeyOf(userId), JSON.stringify(recent));
  } catch (error) {
    logger.warn({ err: error }, 'recent applications not stored');
  }
}
