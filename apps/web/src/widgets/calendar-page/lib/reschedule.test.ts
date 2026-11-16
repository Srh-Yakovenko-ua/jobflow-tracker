import { describe, expect, it } from 'vitest';

import { ACME_APPLICATION } from '@/test/application-fixtures';
import {
  AUTO_GHOST_ITEM,
  droppedAt,
  FOLLOWUP_ITEM,
  scheduledItemOf,
} from '@/test/calendar-fixtures';

import { rescheduleOf } from './reschedule';

const INTERVIEW = scheduledItemOf({
  serial: 612,
  kind: 'final_interview',
  start: '2026-11-04T12:00:00.000Z',
});

describe('rescheduleOf', () => {
  it('turns a dropped interview into its new start in UTC for its own card', () => {
    const dropped = droppedAt({ item: INTERVIEW, start: '2026-11-05T11:30:00+02:00' });

    expect(rescheduleOf(dropped)).toEqual({
      applicationId: ACME_APPLICATION.id,
      eventId: INTERVIEW.id,
      startsAt: '2026-11-05T09:30:00.000Z',
    });
  });

  it('has nothing to send for an interview dropped into the all-day row', () => {
    const dropped = droppedAt({
      item: INTERVIEW,
      start: '2026-11-05T00:00:00+02:00',
      allDay: true,
    });

    expect(rescheduleOf(dropped)).toBeNull();
  });

  it.each([
    { name: 'a follow-up', item: FOLLOWUP_ITEM },
    { name: 'an auto ghost date', item: AUTO_GHOST_ITEM },
  ])('has nothing to send for $name', ({ item }) => {
    const dropped = droppedAt({ item, start: '2026-11-05T00:00:00+02:00' });

    expect(rescheduleOf(dropped)).toBeNull();
  });

  it('has nothing to send for an event the grid did not build from the feed', () => {
    const dropped = droppedAt({ item: INTERVIEW, start: '2026-11-05T11:30:00+02:00' });

    expect(rescheduleOf({ ...dropped, extendedProps: {} })).toBeNull();
  });
});
