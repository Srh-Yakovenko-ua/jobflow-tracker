import type { Application } from '@jobflow/shared';

export const scheduledEventKeys = {
  all: ['scheduled-events'] as const,
  list: (applicationId: Application['id']) =>
    [...scheduledEventKeys.all, 'list', applicationId] as const,
};
