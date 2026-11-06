import { describe, expect, it } from 'vitest';

import { ACME_APPLICATION } from '@/test/application-fixtures';
import { droppedAt, FOLLOWUP_ITEM, scheduledItemOf } from '@/test/calendar-fixtures';

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

  it('has nothing to send for a follow-up', () => {
    const dropped = droppedAt({ item: FOLLOWUP_ITEM, start: '2026-11-05T00:00:00+02:00' });

    expect(rescheduleOf(dropped)).toBeNull();
  });

  it('has nothing to send for an event the grid did not build from the feed', () => {
    const dropped = droppedAt({ item: INTERVIEW, start: '2026-11-05T11:30:00+02:00' });

    expect(rescheduleOf({ ...dropped, extendedProps: {} })).toBeNull();
  });
});
