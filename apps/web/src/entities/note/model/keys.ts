import type { Application } from '@jobflow/shared';

export const noteKeys = {
  all: ['notes'] as const,
  list: (applicationId: Application['id']) => [...noteKeys.all, 'list', applicationId] as const,
};
