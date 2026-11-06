import { describe, expect, it, vi } from 'vitest';

import type { RescheduleDrop } from '@/features/schedule-event';
import { ACME_APPLICATION } from '@/test/application-fixtures';
import { droppedAt, FOLLOWUP_ITEM, scheduledItemOf } from '@/test/calendar-fixtures';

import { gridHandlersOf } from './grid-handlers';

const INTERVIEW = scheduledItemOf({
  serial: 613,
  kind: 'tech_interview',
  start: '2026-11-04T12:00:00.000Z',
});

function dropHandler() {
  const onReschedule = vi.fn<(drop: RescheduleDrop) => void>();
  const { eventDrop } = gridHandlersOf({ onPeriod: vi.fn(), onOpen: vi.fn(), onReschedule });
  return { eventDrop, onReschedule, revert: vi.fn<() => void>() };
}

describe('gridHandlersOf eventDrop', () => {
  it('sends a dropped interview with the grid revert attached, leaving it in place', () => {
    const { eventDrop, onReschedule, revert } = dropHandler();

    eventDrop({
      event: droppedAt({ item: INTERVIEW, start: '2026-11-05T11:30:00+02:00' }),
      revert,
    });

    expect(onReschedule.mock.calls).toEqual([
      [
        {
          applicationId: ACME_APPLICATION.id,
          eventId: INTERVIEW.id,
          startsAt: '2026-11-05T09:30:00.000Z',
          revert,
        },
      ],
    ]);
    expect(revert).not.toHaveBeenCalled();
  });

  it('puts a dropped follow-up back without a request', () => {
    const { eventDrop, onReschedule, revert } = dropHandler();

    eventDrop({ event: droppedAt({ item: FOLLOWUP_ITEM, start: '2026-11-05' }), revert });

    expect(revert).toHaveBeenCalledOnce();
    expect(onReschedule).not.toHaveBeenCalled();
  });
});
