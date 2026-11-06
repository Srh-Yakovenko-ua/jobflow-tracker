import { describe, expect, it } from 'vitest';

import { dayKeyOf, instantOf, wallClockOf } from './zoned-time';

const KYIV = 'Europe/Kyiv';

const NEW_YORK = 'America/New_York';

describe('zoned time', () => {
  it.each([
    { timeZone: KYIV, day: '2026-11-06' },
    { timeZone: 'UTC', day: '2026-11-05' },
    { timeZone: NEW_YORK, day: '2026-11-05' },
  ])('an instant late on 5 November falls on $day in $timeZone', ({ timeZone, day }) => {
    expect(dayKeyOf(new Date('2026-11-05T22:30:00Z'), timeZone)).toBe(day);
  });

  it.each([
    {
      name: 'Kyiv winter',
      timeZone: KYIV,
      day: '2026-11-06',
      time: '16:00',
      iso: '2026-11-06T14:00:00.000Z',
    },
    {
      name: 'Kyiv summer',
      timeZone: KYIV,
      day: '2026-07-01',
      time: '16:00',
      iso: '2026-07-01T13:00:00.000Z',
    },
    {
      name: 'Kyiv spring change day, morning',
      timeZone: KYIV,
      day: '2026-03-29',
      time: '10:00',
      iso: '2026-03-29T07:00:00.000Z',
    },
    {
      name: 'Kyiv spring change day, before the jump',
      timeZone: KYIV,
      day: '2026-03-29',
      time: '02:30',
      iso: '2026-03-29T00:30:00.000Z',
    },
    {
      name: 'Kyiv autumn change day, morning',
      timeZone: KYIV,
      day: '2026-10-25',
      time: '10:00',
      iso: '2026-10-25T08:00:00.000Z',
    },
    {
      name: 'Kyiv autumn change day, before the repeat',
      timeZone: KYIV,
      day: '2026-10-25',
      time: '02:30',
      iso: '2026-10-24T23:30:00.000Z',
    },
    {
      name: 'UTC',
      timeZone: 'UTC',
      day: '2026-11-06',
      time: '16:00',
      iso: '2026-11-06T16:00:00.000Z',
    },
    {
      name: 'New York winter',
      timeZone: NEW_YORK,
      day: '2026-01-15',
      time: '16:00',
      iso: '2026-01-15T21:00:00.000Z',
    },
    {
      name: 'New York summer',
      timeZone: NEW_YORK,
      day: '2026-07-01',
      time: '16:00',
      iso: '2026-07-01T20:00:00.000Z',
    },
  ])('$name: $day $time is $iso and reads back the same', ({ timeZone, day, time, iso }) => {
    expect(instantOf({ day, time, timeZone })).toBe(iso);
    expect(wallClockOf(iso, timeZone)).toEqual({ day, time });
  });

  it('a time the spring jump skips lands an hour later, at the same instant as 04:30', () => {
    const skipped = instantOf({ day: '2026-03-29', time: '03:30', timeZone: KYIV });

    expect(skipped).toBe('2026-03-29T01:30:00.000Z');
    expect(wallClockOf(skipped, KYIV)).toEqual({ day: '2026-03-29', time: '04:30' });
  });

  it('the hour the autumn change repeats reads 03:30 twice and resolves to the second one', () => {
    expect(wallClockOf('2026-10-25T00:30:00.000Z', KYIV)).toEqual({
      day: '2026-10-25',
      time: '03:30',
    });
    expect(wallClockOf('2026-10-25T01:30:00.000Z', KYIV)).toEqual({
      day: '2026-10-25',
      time: '03:30',
    });
    expect(instantOf({ day: '2026-10-25', time: '03:30', timeZone: KYIV })).toBe(
      '2026-10-25T01:30:00.000Z',
    );
  });
});
