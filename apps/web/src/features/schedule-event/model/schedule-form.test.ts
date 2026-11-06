import { createScheduledEventInputSchema, type Stage } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { scheduledEventOf } from '@/test/scheduled-event-fixtures';

import {
  scheduleDefaultsOf,
  scheduleFormSchemaOf,
  type ScheduleFormValues,
  toScheduledEventInput,
} from './schedule-form';

const KYIV = 'Europe/Kyiv';

const AFTERNOON = new Date('2026-11-06T14:00:00Z');

const VALUES: ScheduleFormValues = {
  kind: 'screening_call',
  day: '2026-11-06',
  time: '16:30',
  durationMin: 45,
  locationOrLink: '  https://meet.example.com/acme  ',
};

function parsedAt(values: ScheduleFormValues, now: Date = AFTERNOON) {
  return scheduleFormSchemaOf({ timeZone: KYIV, clock: () => now }).safeParse(values);
}

function issuesOf(values: ScheduleFormValues) {
  const parsed = parsedAt(values);
  return parsed.success ? [] : parsed.error.issues.map(({ path, message }) => ({ path, message }));
}

describe('scheduleDefaultsOf', () => {
  it.each<[Stage, string]>([
    ['applied', 'screening_call'],
    ['screening', 'tech_interview'],
    ['tech_interview', 'tech_interview'],
    ['final', 'final_interview'],
    ['offer', 'offer_call'],
    ['ghosted', 'other'],
  ])('a new event for an application in %s starts as %s', (stage, kind) => {
    expect(scheduleDefaultsOf({ stage, now: AFTERNOON, timeZone: KYIV }).kind).toBe(kind);
  });

  it('a new event is tomorrow in the user zone at 10:00 for 60 minutes with no place', () => {
    const lateEvening = new Date('2026-11-06T22:30:00Z');

    expect(scheduleDefaultsOf({ stage: 'applied', now: lateEvening, timeZone: KYIV })).toEqual({
      kind: 'screening_call',
      day: '2026-11-08',
      time: '10:00',
      durationMin: 60,
      locationOrLink: '',
    });
  });

  it('a reschedule starts from the event wall clock in the user zone', () => {
    const event = scheduledEventOf({
      kind: 'final_interview',
      startsAt: '2026-11-06T14:00:00Z',
      durationMin: 90,
      locationOrLink: 'Kyiv, Khreshchatyk 1',
    });

    expect(scheduleDefaultsOf({ stage: 'final', event, now: AFTERNOON, timeZone: KYIV })).toEqual({
      kind: 'final_interview',
      day: '2026-11-06',
      time: '16:00',
      durationMin: 90,
      locationOrLink: 'Kyiv, Khreshchatyk 1',
    });
  });
});

describe('scheduleFormSchemaOf', () => {
  it('refuses a start equal to now on the time field', () => {
    expect(issuesOf({ ...VALUES, time: '16:00' })).toEqual([
      { path: ['time'], message: 'Цей час уже минув' },
    ]);
  });

  it('accepts a start one minute after now', () => {
    expect(parsedAt({ ...VALUES, time: '16:01' }).success).toBe(true);
  });

  it('reads now when it validates, not when the schema was made', () => {
    let now = new Date('2026-11-06T12:00:00Z');
    const schema = scheduleFormSchemaOf({ timeZone: KYIV, clock: () => now });
    now = new Date('2026-11-06T15:00:00Z');

    expect(schema.safeParse(VALUES).success).toBe(false);
  });

  it('asks for a time when the time input is cleared, without checking the start', () => {
    expect(issuesOf({ ...VALUES, time: '' })).toEqual([{ path: ['time'], message: 'Вкажи час' }]);
  });

  it.each([4, 481])('refuses a duration of %i minutes', (durationMin) => {
    expect(issuesOf({ ...VALUES, durationMin }).map(({ path }) => path)).toEqual([['durationMin']]);
  });

  it.each([5, 480])('accepts a duration of %i minutes', (durationMin) => {
    expect(parsedAt({ ...VALUES, durationMin }).success).toBe(true);
  });

  it('trims the link or place, and a blank one becomes null', () => {
    expect(parsedAt(VALUES).data?.locationOrLink).toBe('https://meet.example.com/acme');
    expect(parsedAt({ ...VALUES, locationOrLink: '   ' }).data?.locationOrLink).toBeNull();
  });
});

describe('toScheduledEventInput', () => {
  it('sends the wall clock of the user zone as a UTC instant the shared schema accepts', () => {
    const parsed = parsedAt(VALUES);
    if (!parsed.success) throw new Error('the design values must parse');

    const input = toScheduledEventInput({ values: parsed.data, timeZone: KYIV });

    expect(input).toEqual({
      kind: 'screening_call',
      startsAt: '2026-11-06T14:30:00.000Z',
      durationMin: 45,
      locationOrLink: 'https://meet.example.com/acme',
    });
    expect(createScheduledEventInputSchema.safeParse(input).success).toBe(true);
  });
});
