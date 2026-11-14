import type { Reminder, ReminderListResponse } from '@jobflow/shared';
import { addDays } from 'date-fns';

import {
  reminderKeys,
  remindersQueryOptions,
  type SnoozeReminder,
  snoozeReminder,
} from '@/entities/reminder';
import { useOptimisticMutation } from '@/shared/api';
import { uk } from '@/shared/i18n';

const { queryKey: LIST_KEY } = remindersQueryOptions();

function snoozedIn(reminder: Reminder, { id, days }: SnoozeReminder): Reminder {
  if (reminder.id !== id) return reminder;
  return { ...reminder, status: 'snoozed', snoozedUntil: addDays(new Date(), days).toISOString() };
}

export function useSnoozeReminderMutation() {
  return useOptimisticMutation({
    queryKey: LIST_KEY,
    invalidateKey: reminderKeys.all,
    update: (list: ReminderListResponse, snooze: SnoozeReminder) => ({
      items: list.items.map((reminder) => snoozedIn(reminder, snooze)),
    }),
    request: snoozeReminder,
    failure: uk.reminders.snoozeFailed,
  });
}
