import { applicationResponseSchema } from '@jobflow/shared';
import type { z } from 'zod';

import { userStorageKeyOf } from '@/entities/user';
import { readStoredJson, writeStoredJson } from '@/shared/lib/stored-json';

const recentApplicationSchema = applicationResponseSchema.pick({
  id: true,
  company: true,
  position: true,
});

const recentListSchema = recentApplicationSchema.array();

export type RecentApplication = z.infer<typeof recentApplicationSchema>;

export type RememberedApplication = Readonly<{ userId: string; application: RecentApplication }>;

const RECENT_LIMIT = 5;

function recentsKeyOf(userId: string): string {
  return userStorageKeyOf({ name: 'recent-applications', userId });
}

export function readRecentApplications(userId: string): RecentApplication[] {
  return (readStoredJson(recentsKeyOf(userId), recentListSchema) ?? []).slice(0, RECENT_LIMIT);
}

export function rememberRecentApplication({ userId, application }: RememberedApplication): void {
  const { id, company, position } = application;
  const others = readRecentApplications(userId).filter((recent) => recent.id !== id);
  const recent = [{ id, company, position }, ...others].slice(0, RECENT_LIMIT);
  writeStoredJson(recentsKeyOf(userId), recent);
}
