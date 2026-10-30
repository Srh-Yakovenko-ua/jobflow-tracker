import { describe, expect, it } from 'vitest';

import { formatTimelineDate } from './timeline-date';

const KYIV = 'Europe/Kyiv';

const NOW = new Date('2026-09-07T06:00:00Z');

function dateOf(at: string, now = NOW): string {
  return formatTimelineDate({ at: new Date(at), now, timeZone: KYIV });
}

describe('formatTimelineDate', () => {
  it.for([
    { days: 'an event earlier today', at: '2026-09-07T04:00:00Z', expected: 'сьогодні' },
    { days: 'two calendar days back', at: '2026-09-05T15:00:00Z', expected: 'позавчора' },
    { days: 'four days back', at: '2026-09-03T10:00:00Z', expected: '4 дні тому' },
    { days: 'day 6', at: '2026-09-01T10:00:00Z', expected: '6 днів тому' },
    { days: 'day 7', at: '2026-08-31T10:00:00Z', expected: '31.08' },
    { days: 'a month back', at: '2026-08-12T10:00:00Z', expected: '12.08' },
  ])('$days reads $expected', ({ at, expected }) => {
    expect(dateOf(at)).toBe(expected);
  });

  it('23:30 local yesterday reads "учора" while UTC is still the same day', () => {
    const justAfterMidnight = new Date('2026-09-06T21:30:00Z');

    expect(dateOf('2026-09-06T20:30:00Z', justAfterMidnight)).toBe('учора');
  });

  it('00:10 local today reads "сьогодні" while UTC is still the day before', () => {
    expect(dateOf('2026-09-06T21:10:00Z')).toBe('сьогодні');
  });

  it('a date from an earlier year carries its year', () => {
    expect(dateOf('2025-12-31T10:00:00Z', new Date('2026-01-12T10:00:00Z'))).toBe('31.12.2025');
  });

  it('the year comes from the user timezone, not from UTC', () => {
    expect(dateOf('2025-12-31T22:30:00Z', new Date('2026-01-20T10:00:00Z'))).toBe('01.01');
  });
});
