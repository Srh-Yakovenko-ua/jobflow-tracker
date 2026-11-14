import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { REFUSED_CONNECTION } from '@/test/api-handlers';
import { boardRoute } from '@/test/board-fixtures';
import { pinClockInEachTest } from '@/test/pinned-clock';
import {
  REMINDER_LIST,
  REMINDER_NOW,
  type RemindersRouteOptions,
  remindersRoutes,
  SILENT_CARDS,
} from '@/test/reminder-fixtures';
import { renderHookInApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import { useSilentCount } from './use-silent-count';

const SILENT_COUNTS = { applied: 1, screening: 1, tech_interview: 1 };

pinClockInEachTest(REMINDER_NOW);

function renderCount(routes: RemindersRouteOptions) {
  const reminders = remindersRoutes(routes);
  server.use(
    boardRoute({ counts: SILENT_COUNTS, cards: SILENT_CARDS }).handler,
    ...reminders.handlers,
  );
  return renderHookInApp(() => useSilentCount()).result;
}

describe('useSilentCount', () => {
  it('a snoozed card leaves the silent badge, and a card whose snooze ran out stays in it', async () => {
    const count = renderCount({ items: REMINDER_LIST.items });

    await waitFor(() => {
      expect(count.current).toBe(2);
    });
  });

  it('counts every silent card when the reminders cannot be loaded', async () => {
    const count = renderCount({ listReply: REFUSED_CONNECTION.reply });

    await waitFor(() => {
      expect(count.current).toBe(3);
    });
  });
});
