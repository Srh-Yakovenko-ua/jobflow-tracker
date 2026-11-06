import { useQueryClient } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { scheduledEventKeys } from '@/entities/scheduled-event';
import { errorReply } from '@/test/api-handlers';
import { ACME_APPLICATION } from '@/test/application-fixtures';
import { KYIV_WEEK } from '@/test/calendar-fixtures';
import { latch } from '@/test/latch';
import { renderHookInApp } from '@/test/render-in-app';
import {
  SCHEDULED_EVENT_ID,
  scheduledEventOf,
  scheduledEventRoutes,
  type ScheduledEventUpdateOptions,
} from '@/test/scheduled-event-fixtures';
import { server } from '@/test/server';

import { useRescheduleEventMutation } from './use-reschedule-event-mutation';

const PLANNED = scheduledEventOf({ startsAt: '2026-11-04T12:00:00.000Z' });

function renderReschedule(update: ScheduledEventUpdateOptions = {}) {
  const routes = scheduledEventRoutes({ items: [PLANNED], update });
  server.use(...routes.handlers);
  const { result } = renderHookInApp(() => ({
    mutation: useRescheduleEventMutation(),
    queryClient: useQueryClient(),
  }));
  const drop = (startsAt: string) => {
    const revert = vi.fn<() => void>();
    act(() => {
      result.current.mutation.reschedule({
        applicationId: ACME_APPLICATION.id,
        eventId: SCHEDULED_EVENT_ID,
        startsAt,
        revert,
      });
    });
    return revert;
  };
  return { result, sent: routes.sent.updated, drop };
}

type SentPatches = ReturnType<typeof renderReschedule>['sent'];

async function waitForStarts(sent: SentPatches, starts: readonly string[]) {
  await waitFor(() => {
    expect(sent.map((patch) => patch.body.startsAt)).toEqual(starts);
  });
}

afterEach(() => {
  toast.dismiss();
});

describe('useRescheduleEventMutation', () => {
  it('sends only the new start, in UTC, to the dropped event', async () => {
    const { sent, drop } = renderReschedule();

    drop('2026-11-05T09:30:00.000Z');

    await waitFor(() => {
      expect(sent).toEqual([
        { itemId: SCHEDULED_EVENT_ID, body: { startsAt: '2026-11-05T09:30:00.000Z' } },
      ]);
    });
  });

  it('marks the calendar and the card schedule stale once the move is saved, and keeps the drop', async () => {
    const { result, sent, drop } = renderReschedule();
    const listKey = scheduledEventKeys.list(ACME_APPLICATION.id);
    act(() => {
      result.current.queryClient.setQueryData(scheduledEventKeys.calendar(KYIV_WEEK), {
        items: [],
      });
      result.current.queryClient.setQueryData(listKey, { items: [PLANNED] });
    });

    const revert = drop('2026-11-05T09:30:00.000Z');

    await waitFor(() => {
      expect(
        result.current.queryClient.getQueryState(scheduledEventKeys.calendar(KYIV_WEEK))
          ?.isInvalidated,
      ).toBe(true);
    });
    expect(result.current.queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
    expect(sent).toHaveLength(1);
    expect(revert).not.toHaveBeenCalled();
  });

  it.each([
    { status: 500, type: 'internal_error', toast: 'Не вдалося зберегти' },
    { status: 409, type: 'conflict', toast: 'Подію вже змінено' },
  ] as const)(
    'a $status puts the event back where it was and says $toast',
    async ({ status, type, toast: title }) => {
      const { drop } = renderReschedule({ reply: () => errorReply({ status, type }) });

      const revert = drop('2026-11-05T09:30:00.000Z');

      expect(await screen.findByText(title)).toBeDefined();
      expect(revert).toHaveBeenCalledOnce();
    },
  );

  it('sends a second drop of the same event only after the first one has answered', async () => {
    const held = latch();
    const { sent, drop } = renderReschedule({ latch: held });

    drop('2026-11-05T09:30:00.000Z');
    drop('2026-11-06T15:00:00.000Z');

    await waitForStarts(sent, ['2026-11-05T09:30:00.000Z']);
    held.release();
    await waitForStarts(sent, ['2026-11-05T09:30:00.000Z', '2026-11-06T15:00:00.000Z']);
  });
});
