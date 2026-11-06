import type { Application, CalendarQuery } from '@jobflow/shared';

export const scheduledEventKeys = {
  all: ['scheduled-events'] as const,
  list: (applicationId: Application['id']) =>
    [...scheduledEventKeys.all, 'list', applicationId] as const,
  calendars: () => [...scheduledEventKeys.all, 'calendar'] as const,
  calendar: (range: CalendarQuery) => [...scheduledEventKeys.calendars(), range] as const,
};
