import { describe, expect, it } from 'vitest';

import { formatNextEvent } from './next-event';

const KYIV = 'Europe/Kyiv';

const NOW = new Date('2026-10-23T09:00:00Z');

describe('formatNextEvent', () => {
  it('a call later today reads "дзвінок сьогодні, 16:00" in the user timezone', () => {
    const event = { kind: 'screening_call', startsAt: '2026-10-23T13:00:00Z' } as const;

    expect(formatNextEvent({ event, now: NOW, timeZone: KYIV })).toBe('дзвінок сьогодні, 16:00');
  });

  it('an interview on the next calendar day reads "завтра"', () => {
    const event = { kind: 'tech_interview', startsAt: '2026-10-24T07:30:00Z' } as const;

    expect(formatNextEvent({ event, now: NOW, timeZone: KYIV })).toBe("техінтерв'ю завтра, 10:30");
  });

  it('a later event shows the short date and time', () => {
    const event = { kind: 'other', startsAt: '2026-10-28T14:00:00Z' } as const;

    expect(formatNextEvent({ event, now: NOW, timeZone: KYIV })).toBe('зустріч 28 жовт., 16:00');
  });

  it('the calendar day comes from the given timezone, not from UTC', () => {
    const now = new Date('2026-10-23T20:00:00Z');
    const event = { kind: 'offer_call', startsAt: '2026-10-23T22:30:00Z' } as const;

    expect(formatNextEvent({ event, now, timeZone: KYIV })).toBe(
      'дзвінок щодо оферу завтра, 01:30',
    );
    expect(formatNextEvent({ event, now, timeZone: 'UTC' })).toBe(
      'дзвінок щодо оферу сьогодні, 22:30',
    );
  });

  it('the 25-hour day when clocks go back still reads as today', () => {
    const now = new Date('2026-10-24T21:10:00Z');
    const event = { kind: 'final_interview', startsAt: '2026-10-25T21:30:00Z' } as const;

    expect(formatNextEvent({ event, now, timeZone: KYIV })).toBe('фінал сьогодні, 23:30');
  });
});
