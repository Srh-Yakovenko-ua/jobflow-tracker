import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { APPLICATION_ID, REMINDER_ID, SCHEDULED_EVENT_ID } from '../../test/service-fixtures.js';
import { type FollowupRow, RemindersService } from '../reminders/index.js';
import { CalendarService } from './calendar.service.js';
import { type CalendarEventRow, ScheduledEventsRepository } from './scheduled-events.repository.js';

type CalendarFixture = { timeZone: string; followups: FollowupRow[] };

const WEEK = { from: '2026-11-02T00:00:00+02:00', to: '2026-11-09T00:00:00+02:00' };

const ACME = { company: 'Acme', currentStage: 'tech_interview' } as const;

const LATER_EVENT_ID = '0199f0a0-0000-7000-8000-000000000103';

const TECH_INTERVIEW: CalendarEventRow = {
  id: SCHEDULED_EVENT_ID,
  applicationId: APPLICATION_ID,
  kind: 'tech_interview',
  startsAt: new Date('2026-11-08T21:00:00.000Z'),
  durationMin: 90,
  locationOrLink: 'https://meet.example.test/abc',
  status: 'planned',
  ...ACME,
};

const followup = (fields: Partial<FollowupRow>): FollowupRow => ({
  id: REMINDER_ID,
  applicationId: APPLICATION_ID,
  status: 'pending',
  dueAt: new Date('2026-11-08T21:30:00.000Z'),
  snoozedUntil: null,
  application: ACME,
  ...fields,
});

async function calendarWith({ timeZone, followups }: CalendarFixture) {
  const events = [{ ...TECH_INTERVIEW, id: LATER_EVENT_ID }, TECH_INTERVIEW];
  const moduleRef = await Test.createTestingModule({
    providers: [CalendarService, ScheduledEventsRepository, RemindersService],
  })
    .overrideProvider(ScheduledEventsRepository)
    .useValue({
      findCalendarEvents: () => Promise.resolve(events),
      findTimeZone: () => Promise.resolve(timeZone),
    })
    .overrideProvider(RemindersService)
    .useValue({ followupsBetween: () => Promise.resolve(followups) })
    .compile();
  return moduleRef.get(CalendarService);
}

describe('CalendarService.items', () => {
  it('gives an event its UTC start, its end after the duration and its application in extendedProps', async () => {
    const calendar = await calendarWith({ timeZone: 'Europe/Kyiv', followups: [] });

    const { items } = await calendar.items(APPLICATION_ID, WEEK);

    expect(items[0]).toEqual({
      id: SCHEDULED_EVENT_ID,
      title: "Техінтерв'ю · Acme",
      start: '2026-11-08T21:00:00.000Z',
      end: '2026-11-08T22:30:00.000Z',
      allDay: false,
      extendedProps: {
        type: 'scheduled_event',
        applicationId: APPLICATION_ID,
        company: 'Acme',
        stage: 'tech_interview',
        eventKind: 'tech_interview',
        status: 'planned',
        locationOrLink: 'https://meet.example.test/abc',
      },
    });
  });

  it.each([
    { timeZone: 'Europe/Kyiv', dueAt: '2026-11-08T21:30:00.000Z', date: '2026-11-08' },
    { timeZone: 'Europe/Kyiv', dueAt: '2026-11-08T22:30:00.000Z', date: '2026-11-09' },
    { timeZone: 'America/New_York', dueAt: '2026-11-08T21:30:00.000Z', date: '2026-11-08' },
    { timeZone: 'America/New_York', dueAt: '2026-11-09T04:30:00.000Z', date: '2026-11-08' },
  ])(
    'dates a follow-up due $dueAt as $date for a $timeZone user',
    async ({ timeZone, dueAt, date }) => {
      const calendar = await calendarWith({
        timeZone,
        followups: [followup({ dueAt: new Date(dueAt) })],
      });

      const { items } = await calendar.items(APPLICATION_ID, WEEK);

      expect(items.find(({ allDay }) => allDay)).toEqual({
        id: REMINDER_ID,
        title: 'Фоллоу-ап · Acme',
        start: date,
        end: null,
        allDay: true,
        extendedProps: {
          type: 'followup',
          applicationId: APPLICATION_ID,
          company: 'Acme',
          stage: 'tech_interview',
          reminderStatus: 'pending',
        },
      });
    },
  );

  it('dates a snoozed follow-up by the end of its snooze', async () => {
    const snoozed = followup({ status: 'snoozed', snoozedUntil: new Date('2026-11-05T08:00:00Z') });
    const calendar = await calendarWith({ timeZone: 'Europe/Kyiv', followups: [snoozed] });

    const { items } = await calendar.items(APPLICATION_ID, WEEK);

    expect(items.find(({ allDay }) => allDay)?.start).toBe('2026-11-05');
  });

  it('sorts the items by start, then id', async () => {
    const calendar = await calendarWith({ timeZone: 'Europe/Kyiv', followups: [followup({})] });

    const { items } = await calendar.items(APPLICATION_ID, WEEK);

    expect(items.map(({ id, start }) => [start, id])).toEqual([
      ['2026-11-08', REMINDER_ID],
      ['2026-11-08T21:00:00.000Z', SCHEDULED_EVENT_ID],
      ['2026-11-08T21:00:00.000Z', LATER_EVENT_ID],
    ]);
  });
});
