import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, describe, expect, it } from 'vitest';

import { remindersQueryOptions } from '@/entities/reminder';
import { uk } from '@/shared/i18n';
import { errorReply, NEVER_ANSWERS } from '@/test/api-handlers';
import { pinClockInEachTest } from '@/test/pinned-clock';
import {
  IN_THREE_DAYS,
  REMINDER_LIST,
  REMINDER_NOW,
  reminderIdOf,
  type RemindersRouteOptions,
  remindersRoutes,
  ZORIA_SILENT,
} from '@/test/reminder-fixtures';
import { renderHookInApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import { useSnoozeReminderMutation } from './use-snooze-reminder-mutation';

const ZORIA_REMINDER = reminderIdOf(ZORIA_SILENT);

pinClockInEachTest(REMINDER_NOW);

function renderSnooze(routes: RemindersRouteOptions = {}) {
  const reminders = remindersRoutes({ items: REMINDER_LIST.items, ...routes });
  server.use(...reminders.handlers);
  const { result } = renderHookInApp(() => ({
    snooze: useSnoozeReminderMutation(),
    queryClient: useQueryClient(),
  }));
  act(() => {
    result.current.queryClient.setQueryData(remindersQueryOptions().queryKey, REMINDER_LIST);
  });
  return { result, sent: reminders.sent };
}

function zoriaIn(queryClient: QueryClient) {
  const list = queryClient.getQueryData(remindersQueryOptions().queryKey);
  return list?.items.find((reminder) => reminder.id === ZORIA_REMINDER);
}

afterEach(() => {
  toast.dismiss();
});

describe('useSnoozeReminderMutation', () => {
  it('snoozes the followup in the cache at once and posts the chosen days', async () => {
    const { result, sent } = renderSnooze({ snoozeReply: NEVER_ANSWERS.reply });

    act(() => {
      result.current.snooze.mutate({ id: ZORIA_REMINDER, days: 3 });
    });

    await waitFor(() => {
      expect(zoriaIn(result.current.queryClient)).toMatchObject({
        status: 'snoozed',
        snoozedUntil: IN_THREE_DAYS,
      });
    });
    await waitFor(() => {
      expect(sent.snoozes).toEqual([{ id: ZORIA_REMINDER, body: { days: 3 } }]);
    });
  });

  it('a 409 puts the followup back as it was and says the snooze failed', async () => {
    const { result } = renderSnooze({
      snoozeReply: () => errorReply({ status: 409, type: 'conflict' }),
    });

    act(() => {
      result.current.snooze.mutate({ id: ZORIA_REMINDER, days: 7 });
    });

    expect(await screen.findByText(uk.reminders.snoozeFailed.title)).toBeDefined();
    expect(zoriaIn(result.current.queryClient)).toMatchObject({
      status: 'pending',
      snoozedUntil: null,
    });
    expect(toast.getToasts()).toHaveLength(1);
  });
});
