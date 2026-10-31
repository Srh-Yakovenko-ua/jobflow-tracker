import { z } from 'zod';

import { apiClient } from '@/shared/api';

export type LogoutScope = 'this' | 'all';

const LOGOUT_PATHS: Readonly<Record<LogoutScope, string>> = {
  this: '/auth/logout',
  all: '/auth/logout-all',
};

export function logout(scope: LogoutScope): Promise<void> {
  return apiClient.request({ path: LOGOUT_PATHS[scope], method: 'POST', schema: z.void() });
}
