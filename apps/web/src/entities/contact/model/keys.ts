import type { Application } from '@jobflow/shared';

export const contactKeys = {
  all: ['contacts'] as const,
  list: (applicationId: Application['id']) => [...contactKeys.all, 'list', applicationId] as const,
};
