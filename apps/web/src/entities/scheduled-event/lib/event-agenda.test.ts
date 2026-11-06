import { describe, expect, it } from 'vitest';

import { fixtureIdOf } from '@/test/board-fixtures';
import { scheduledEventOf } from '@/test/scheduled-event-fixtures';

import { eventAgendaOf } from './event-agenda';

const NOW = new Date('2026-11-06T12:00:00.000Z');

const EVENTS = {
  earlierOverdue: scheduledEventOf({ id: fixtureIdOf(601), startsAt: '2026-11-04T09:00:00.000Z' }),
  laterOverdue: scheduledEventOf({ id: fixtureIdOf(602), startsAt: '2026-11-05T15:00:00.000Z' }),
  startingNow: scheduledEventOf({ id: fixtureIdOf(603), startsAt: '2026-11-06T12:00:00.000Z' }),
  tomorrow: scheduledEventOf({ id: fixtureIdOf(604), startsAt: '2026-11-07T10:00:00.000Z' }),
  doneOverdue: scheduledEventOf({
    id: fixtureIdOf(605),
    startsAt: '2026-11-03T09:00:00.000Z',
    status: 'done',
  }),
  cancelledSoon: scheduledEventOf({
    id: fixtureIdOf(606),
    startsAt: '2026-11-06T13:00:00.000Z',
    status: 'cancelled',
  }),
};

describe('eventAgendaOf', () => {
  it('counts an event starting exactly now as upcoming, not awaiting an outcome', () => {
    const agenda = eventAgendaOf({ events: [EVENTS.startingNow, EVENTS.tomorrow], now: NOW });

    expect(agenda).toEqual({ upcoming: EVENTS.startingNow, awaitingOutcome: undefined });
  });

  it('asks about the earliest overdue planned event and shows the first future one', () => {
    const agenda = eventAgendaOf({
      events: [EVENTS.tomorrow, EVENTS.laterOverdue, EVENTS.earlierOverdue],
      now: NOW,
    });

    expect(agenda).toEqual({ upcoming: EVENTS.tomorrow, awaitingOutcome: EVENTS.earlierOverdue });
  });

  it('never shows a done or cancelled event', () => {
    const agenda = eventAgendaOf({
      events: [EVENTS.doneOverdue, EVENTS.cancelledSoon],
      now: NOW,
    });

    expect(agenda).toEqual({ upcoming: undefined, awaitingOutcome: undefined });
  });

  it('skips a cancelled event for the next planned one after it', () => {
    const agenda = eventAgendaOf({
      events: [EVENTS.doneOverdue, EVENTS.cancelledSoon, EVENTS.tomorrow],
      now: NOW,
    });

    expect(agenda).toEqual({ upcoming: EVENTS.tomorrow, awaitingOutcome: undefined });
  });
});
