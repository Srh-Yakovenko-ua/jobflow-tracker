import { describe, expect, it } from 'vitest';

import { issuePathsOf } from '../test/zod-issues.js';
import {
  CALENDAR_LIMITS,
  type CalendarItem,
  calendarItemSchema,
  calendarQuerySchema,
  createScheduledEventInputSchema,
  SCHEDULED_EVENT_LIMITS,
  updateScheduledEventInputSchema,
} from './scheduled-event.js';

const SLOT = { kind: 'tech_interview', startsAt: '2026-11-03T16:00:00+02:00' } as const;

const LOCAL_START = { startsAt: '2026-11-03T16:00:00' };

describe('createScheduledEventInputSchema', () => {
  it('keeps the scheduled event and calendar limits at the agreed bounds', () => {
    expect(SCHEDULED_EVENT_LIMITS).toEqual({
      durationMinMin: 5,
      durationMinMax: 480,
      locationOrLinkMaxLength: 500,
      outcomeNoteMaxLength: 2000,
    });
    expect(CALENDAR_LIMITS).toEqual({ rangeMaxDays: 62 });
  });

  it('plans an interview from a kind and a start with an offset and drops a sent status', () => {
    expect(createScheduledEventInputSchema.parse({ ...SLOT, status: 'done' })).toStrictEqual(SLOT);
  });

  it.for([
    { label: 'a 5-minute call', input: { durationMin: 5 }, paths: [] },
    { label: 'an 8-hour final', input: { durationMin: 480 }, paths: [] },
    { label: 'a 4-minute call', input: { durationMin: 4 }, paths: ['durationMin'] },
    { label: 'a 481-minute call', input: { durationMin: 481 }, paths: ['durationMin'] },
    { label: 'a fractional duration', input: { durationMin: 90.5 }, paths: ['durationMin'] },
    { label: 'a UTC start', input: { startsAt: '2026-11-03T14:00:00Z' }, paths: [] },
    { label: 'a local start with no offset', input: LOCAL_START, paths: ['startsAt'] },
    { label: 'a 500-character link', input: { locationOrLink: 'л'.repeat(500) }, paths: [] },
    {
      label: 'a 501-character link',
      input: { locationOrLink: 'л'.repeat(501) },
      paths: ['locationOrLink'],
    },
    { label: 'a blank link', input: { locationOrLink: ' \t' }, paths: ['locationOrLink'] },
  ])('answers $label with issues at $paths', ({ input, paths }) => {
    const result = createScheduledEventInputSchema.safeParse({ ...SLOT, ...input });
    expect(issuePathsOf(result)).toEqual(paths);
  });
});

describe('updateScheduledEventInputSchema', () => {
  it('refuses an empty patch with the hint to send a field', () => {
    expect(updateScheduledEventInputSchema.safeParse({}).error?.issues).toMatchObject([
      { path: [], message: 'Send at least one field to change' },
    ]);
  });

  it('marks an event done with a trimmed outcome note', () => {
    expect(
      updateScheduledEventInputSchema.parse({ status: 'done', outcomeNote: ' Пройшло добре ' }),
    ).toStrictEqual({ status: 'done', outcomeNote: 'Пройшло добре' });
  });

  it.for([
    { label: 'a local start with no offset', input: LOCAL_START, paths: ['startsAt'] },
    {
      label: 'a 2001-character outcome note',
      input: { outcomeNote: 'н'.repeat(2001) },
      paths: ['outcomeNote'],
    },
    { label: 'an unknown status', input: { status: 'missed' }, paths: ['status'] },
    { label: 'a 481-minute duration', input: { durationMin: 481 }, paths: ['durationMin'] },
  ])('refuses $label at $paths', ({ input, paths }) => {
    expect(issuePathsOf(updateScheduledEventInputSchema.safeParse(input))).toEqual(paths);
  });
});

describe('calendarQuerySchema', () => {
  it.for([
    {
      label: 'a Kyiv week across the 2026-10-25 DST change',
      range: { from: '2026-10-19T00:00:00+03:00', to: '2026-10-26T00:00:00+02:00' },
      paths: [],
    },
    {
      label: 'a 62-day Kyiv range across the DST change',
      range: { from: '2026-10-01T00:00:00+03:00', to: '2026-12-02T00:00:00+02:00' },
      paths: [],
    },
    {
      label: 'a 63-day range',
      range: { from: '2026-10-01T00:00:00Z', to: '2026-12-03T00:00:00Z' },
      paths: ['to'],
    },
    {
      label: 'an empty range',
      range: { from: '2026-10-19T00:00:00Z', to: '2026-10-19T00:00:00Z' },
      paths: ['to'],
    },
    {
      label: 'a range whose to is later on the wall clock but earlier in time',
      range: { from: '2026-10-19T00:00:00-04:00', to: '2026-10-19T02:00:00+03:00' },
      paths: ['to'],
    },
    {
      label: 'a local from with no offset',
      range: { from: '2026-10-19T00:00:00', to: '2026-10-26T00:00:00Z' },
      paths: ['from'],
    },
  ])('answers $label with issues at $paths', ({ range, paths }) => {
    expect(issuePathsOf(calendarQuerySchema.safeParse(range))).toEqual(paths);
  });
});

const CALENDAR_APPLICATION = {
  applicationId: '0199f1a2-7c3b-7d4e-8f50-6a7b8c9d0e1f',
  company: 'Монобанк',
  stage: 'tech_interview',
} as const;

const CALENDAR_ITEMS: { label: string; item: CalendarItem }[] = [
  {
    label: 'a timed interview',
    item: {
      id: '0199f1a2-7c3b-7d4e-8f50-6a7b8c9d0e20',
      title: "Техінтерв'ю",
      start: '2026-11-03T14:00:00.000Z',
      end: '2026-11-03T15:30:00.000Z',
      allDay: false,
      extendedProps: {
        type: 'scheduled_event',
        ...CALENDAR_APPLICATION,
        eventKind: 'tech_interview',
        status: 'planned',
        locationOrLink: null,
      },
    },
  },
  {
    label: 'an all-day follow-up',
    item: {
      id: '0199f1a2-7c3b-7d4e-8f50-6a7b8c9d0e21',
      title: 'Follow-up',
      start: '2026-11-09',
      end: null,
      allDay: true,
      extendedProps: { type: 'followup', ...CALENDAR_APPLICATION, reminderStatus: 'pending' },
    },
  },
];

describe('calendarItemSchema', () => {
  it.for(CALENDAR_ITEMS)('keeps $label as sent', ({ item }) => {
    expect(calendarItemSchema.parse(item)).toStrictEqual(item);
  });

  it('refuses a follow-up that carries no reminder status', () => {
    const followup = {
      ...CALENDAR_ITEMS[1]?.item,
      extendedProps: { type: 'followup', ...CALENDAR_APPLICATION },
    };
    expect(issuePathsOf(calendarItemSchema.safeParse(followup))).toEqual([
      'extendedProps.reminderStatus',
    ]);
  });
});
