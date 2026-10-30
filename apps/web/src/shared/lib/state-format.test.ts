import { describe, expect, it } from 'vitest';

import { formatClock, formatDuration, formatIncidentTime, formatMegabytes } from './state-format';

const KYIV = 'Europe/Kyiv';

const MEBIBYTE = 1024 * 1024;

describe('formatDuration', () => {
  it.each([
    [30, '30 с'],
    [59, '59 с'],
    [60, '1 хв'],
    [90, '2 хв'],
    [120, '2 хв'],
    [121, '3 хв'],
  ])('an ETA of %i s reads "%s", never less than the queue gives', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });
});

describe('formatMegabytes', () => {
  it('an 8.4 MB resume reads "8,4" with a Ukrainian decimal comma', () => {
    expect(formatMegabytes(8_808_038)).toBe('8,4');
  });

  it('the 5 MB limit reads "5", and a file one byte over it never reads as the limit', () => {
    expect(formatMegabytes(5 * MEBIBYTE)).toBe('5');
    expect(formatMegabytes(5 * MEBIBYTE + 1)).toBe('5,1');
  });
});

describe('formatClock', () => {
  it('reads the hour and minute in the given time zone', () => {
    const at = new Date('2026-09-07T12:42:00Z');

    expect(formatClock({ at, timeZone: KYIV })).toBe('15:42');
    expect(formatClock({ at, timeZone: 'UTC' })).toBe('12:42');
  });
});

describe('formatIncidentTime', () => {
  it('reads the day, month and time of the crash in the given time zone', () => {
    const at = new Date('2026-09-07T13:04:00Z');

    expect(formatIncidentTime({ at, timeZone: KYIV })).toBe('07.09, 16:04');
    expect(formatIncidentTime({ at, timeZone: 'UTC' })).toBe('07.09, 13:04');
  });
});
