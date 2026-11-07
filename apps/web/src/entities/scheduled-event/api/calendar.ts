import { type CalendarQuery, calendarResponseSchema } from '@jobflow/shared';
import { queryOptions, skipToken } from '@tanstack/react-query';

import { apiClient, withSearchParams } from '@/shared/api';

import { scheduledEventKeys } from '../model/keys';

export function calendarQueryOptions(range: CalendarQuery | null) {
  return queryOptions({
    queryKey: scheduledEventKeys.calendar(range),
    queryFn:
      range === null
        ? skipToken
        : ({ signal }) =>
            apiClient.request({
              path: withSearchParams('/calendar', range),
              schema: calendarResponseSchema,
              signal,
            }),
  });
}
