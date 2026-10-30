import { describe, expect, it } from 'vitest';

import { formatDaysInFunnel } from './days-in-funnel';

const NOW = new Date('2026-10-30T09:00:00.000Z');

describe('formatDaysInFunnel', () => {
  it.each([
    { appliedAt: '2026-09-19T09:00:00.000Z', text: '41 день у воронці' },
    { appliedAt: '2026-10-27T10:00:00.000Z', text: '3 дні у воронці' },
    { appliedAt: '2026-10-30T06:00:00.000Z', text: '0 днів у воронці' },
  ])('an application applied at $appliedAt reads "$text" in Kyiv', ({ appliedAt, text }) => {
    expect(formatDaysInFunnel({ appliedAt, now: NOW, timeZone: 'Europe/Kyiv' })).toBe(text);
  });

  it.each([
    { timeZone: 'Europe/Kyiv', text: '0 днів у воронці' },
    { timeZone: 'UTC', text: '1 день у воронці' },
  ])('counts calendar days in the user time zone $timeZone', ({ timeZone, text }) => {
    const appliedAt = '2026-10-29T22:30:00.000Z';

    expect(formatDaysInFunnel({ appliedAt, now: NOW, timeZone })).toBe(text);
  });

  it('counts the 23-hour day of the spring DST change in Kyiv as one day', () => {
    const appliedAt = '2026-03-28T22:00:00.000Z';
    const now = new Date('2026-03-29T21:00:00.000Z');

    expect(formatDaysInFunnel({ appliedAt, now, timeZone: 'Europe/Kyiv' })).toBe(
      '1 день у воронці',
    );
  });
});
