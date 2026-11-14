import {
  type Reminder,
  reminderListResponseSchema,
  reminderSchema,
  type SnoozeReminderInput,
} from '@jobflow/shared';
import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '@/shared/api';

import { reminderKeys } from '../model/keys';

export type SnoozeReminder = Readonly<Pick<Reminder, 'id'> & SnoozeReminderInput>;

export function remindersQueryOptions() {
  return queryOptions({
    queryKey: reminderKeys.list(),
    queryFn: ({ signal }) =>
      apiClient.request({ path: '/reminders', schema: reminderListResponseSchema, signal }),
  });
}

export function snoozeReminder({ id, days }: SnoozeReminder) {
  return apiClient.request({
    path: `/reminders/${id}/snooze`,
    method: 'POST',
    body: { days },
    schema: reminderSchema,
  });
}
