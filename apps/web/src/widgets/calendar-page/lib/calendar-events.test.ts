import { describe, expect, it } from 'vitest';

import { FOLLOWUP_ITEM, scheduledItemOf, type ScheduledItemSeed } from '@/test/calendar-fixtures';

import { eventInputOf } from './calendar-events';

const INTERVIEW: ScheduledItemSeed = {
  serial: 611,
  kind: 'tech_interview',
  start: '2026-11-04T12:00:00.000Z',
};

describe('eventInputOf', () => {
  it('hands a planned interview to the grid as a movable event tinted by its stage', () => {
    const item = scheduledItemOf({ ...INTERVIEW, stage: 'screening' });

    expect(eventInputOf(item)).toEqual({
      id: item.id,
      title: "Техінтерв'ю · Acme Technologies",
      start: '2026-11-04T12:00:00.000Z',
      end: '2026-11-04T13:00:00.000Z',
      allDay: false,
      startEditable: true,
      durationEditable: false,
      color: 'color-mix(in oklab, var(--color-stage-screening) 14%, var(--color-surface))',
      contrastColor: 'var(--color-ink)',
      extendedProps: item.extendedProps,
    });
  });

  it.each(['done', 'cancelled'] as const)('keeps a %s event where it happened', (status) => {
    expect(eventInputOf(scheduledItemOf({ ...INTERVIEW, status })).startEditable).toBe(false);
  });

  it('shows a follow-up as a fixed all-day reminder in the accent tint, with no end', () => {
    expect(eventInputOf(FOLLOWUP_ITEM)).toEqual({
      id: FOLLOWUP_ITEM.id,
      title: 'фоллоу-ап · Acme Technologies',
      start: '2026-11-04',
      allDay: true,
      startEditable: false,
      durationEditable: false,
      color: 'var(--color-accent-tint)',
      contrastColor: 'var(--color-accent-ink)',
      extendedProps: FOLLOWUP_ITEM.extendedProps,
    });
  });
});
