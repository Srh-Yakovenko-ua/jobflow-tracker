import { useQuery } from '@tanstack/react-query';

import { meQueryOptions } from '../api/me';
import { userStorageKeyOf, type UserStorageName } from '../lib/user-storage';

export function useUserId(): string | undefined {
  return useQuery({ ...meQueryOptions(), select: (me) => me.user.id }).data;
}

export function useUserStorageKey(name: UserStorageName): string | undefined {
  const userId = useUserId();
  return userId === undefined ? undefined : userStorageKeyOf({ name, userId });
}
