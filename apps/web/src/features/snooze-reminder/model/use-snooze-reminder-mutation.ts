import type { Reminder } from '@jobflow/shared';
import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import { addDays } from 'date-fns';

import {
  reminderKeys,
  remindersQueryOptions,
  type SnoozeReminder,
  snoozeReminder,
} from '@/entities/reminder';
import { uk } from '@/shared/i18n';
import { showErrorToast } from '@/shared/ui/error-toast';

const { queryKey: LIST_KEY } = remindersQueryOptions();

function snoozedIn(reminder: Reminder, { id, days }: SnoozeReminder): Reminder {
  if (reminder.id !== id) return reminder;
  return { ...reminder, status: 'snoozed', snoozedUntil: addDays(new Date(), days).toISOString() };
}

async function withOptimisticSnooze(queryClient: QueryClient, snooze: SnoozeReminder) {
  await queryClient.cancelQueries({ queryKey: LIST_KEY });
  const snapshot = queryClient.getQueryData(LIST_KEY);
  queryClient.setQueryData(
    LIST_KEY,
    (list) => list && { items: list.items.map((reminder) => snoozedIn(reminder, snooze)) },
  );
  try {
    return await snoozeReminder(snooze);
  } catch (error) {
    queryClient.setQueryData(LIST_KEY, snapshot);
    throw error;
  }
}

export function useSnoozeReminderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (snooze: SnoozeReminder) => withOptimisticSnooze(queryClient, snooze),
    onError: () => {
      showErrorToast(uk.reminders.snoozeFailed);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: reminderKeys.all }),
  });
}
