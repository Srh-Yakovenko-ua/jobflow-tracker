import { describe, expect, it } from 'vitest';

import { NEW_USER_SETTINGS } from '../test/factories.js';
import { interviewSoonAt, SILENCE_NOTIFICATION } from '../test/notifications.js';
import { quietHoursDeliveryAt, scheduledDelivery } from './quiet-hours.js';

const NIGHT = {
  timezone: NEW_USER_SETTINGS.timezone,
  quietHoursStart: NEW_USER_SETTINGS.quietHoursStart,
  quietHoursEnd: NEW_USER_SETTINGS.quietHoursEnd,
};

const LUNCH = { ...NIGHT, quietHoursStart: '13:00', quietHoursEnd: '15:00' };

const OFF = { ...NIGHT, quietHoursStart: '22:00', quietHoursEnd: '22:00' };

const deliveryOf = (settings: typeof NIGHT, now: string) =>
  quietHoursDeliveryAt({
    settings,
    notification: SILENCE_NOTIFICATION,
    now: new Date(now),
  }).toISOString();

describe('quietHoursDeliveryAt', () => {
  it.each([
    { local: '23:00 Kyiv', now: '2026-11-14T21:00:00.000Z', at: '2026-11-15T06:00:00.000Z' },
    { local: '22:00 Kyiv', now: '2026-11-14T20:00:00.000Z', at: '2026-11-15T06:00:00.000Z' },
    { local: '01:30 Kyiv', now: '2026-11-14T23:30:00.000Z', at: '2026-11-15T06:00:00.000Z' },
    { local: '07:59 Kyiv', now: '2026-11-15T05:59:00.000Z', at: '2026-11-15T06:00:00.000Z' },
    { local: '08:00 Kyiv', now: '2026-11-15T06:00:00.000Z', at: '2026-11-15T06:00:00.000Z' },
    { local: '21:59 Kyiv', now: '2026-11-14T19:59:00.000Z', at: '2026-11-14T19:59:00.000Z' },
    { local: '12:00 Kyiv', now: '2026-11-14T10:00:00.000Z', at: '2026-11-14T10:00:00.000Z' },
  ])('delivers a silence reminder of $local under 22:00-08:00 at $at', ({ now, at }) => {
    expect(deliveryOf(NIGHT, now)).toBe(at);
  });

  it.each([
    { local: '14:00 Kyiv', now: '2026-11-14T12:00:00.000Z', at: '2026-11-14T13:00:00.000Z' },
    { local: '13:00 Kyiv', now: '2026-11-14T11:00:00.000Z', at: '2026-11-14T13:00:00.000Z' },
    { local: '15:00 Kyiv', now: '2026-11-14T13:00:00.000Z', at: '2026-11-14T13:00:00.000Z' },
    { local: '12:59 Kyiv', now: '2026-11-14T10:59:00.000Z', at: '2026-11-14T10:59:00.000Z' },
    { local: '23:00 Kyiv', now: '2026-11-14T21:00:00.000Z', at: '2026-11-14T21:00:00.000Z' },
  ])('delivers a reminder of $local under 13:00-15:00 at $at', ({ now, at }) => {
    expect(deliveryOf(LUNCH, now)).toBe(at);
  });

  it('delivers at once when quiet hours start and end at the same time', () => {
    expect(deliveryOf(OFF, '2026-11-14T21:00:00.000Z')).toBe('2026-11-14T21:00:00.000Z');
  });

  it('delivers a reminder of 23:00 EEST on the eve of the clock change at 08:00 EET, ten hours later', () => {
    expect(deliveryOf(NIGHT, '2026-10-24T20:00:00.000Z')).toBe('2026-10-25T06:00:00.000Z');
  });

  it.each([
    { startsIn: 60, at: '2026-11-14T21:00:00.000Z' },
    { startsIn: 119, at: '2026-11-14T21:00:00.000Z' },
    { startsIn: 121, at: '2026-11-15T06:00:00.000Z' },
  ])(
    'delivers an interview reminder of 23:00 Kyiv starting in $startsIn min at $at',
    ({ startsIn, at }) => {
      const now = new Date('2026-11-14T21:00:00.000Z');
      const notification = interviewSoonAt(new Date(now.getTime() + startsIn * 60_000));

      const deliverAt = quietHoursDeliveryAt({ settings: NIGHT, notification, now });

      expect(deliverAt.toISOString()).toBe(at);
    },
  );

  it('a 2 h reminder for an interview at 01:00 goes out at once during quiet hours', () => {
    const now = new Date('2026-11-14T21:00:00.000Z');
    const notification = interviewSoonAt(new Date('2026-11-14T23:00:00.000Z'));

    const deliverAt = quietHoursDeliveryAt({ settings: NIGHT, notification, now });

    expect(deliverAt.toISOString()).toBe('2026-11-14T21:00:00.000Z');
  });
});

describe('scheduledDelivery', () => {
  it.each([
    { local: '23:00 Kyiv', now: '2026-11-14T21:00:00.000Z', delayMs: 32_400_000 },
    { local: '12:00 Kyiv', now: '2026-11-14T10:00:00.000Z', delayMs: 0 },
  ])('holds a silence reminder of $local for $delayMs ms', ({ now, delayMs }) => {
    const { deliverAt, delayMs: delay } = scheduledDelivery({
      settings: NIGHT,
      notification: SILENCE_NOTIFICATION,
      now: new Date(now),
    });

    expect([deliverAt.getTime() - Date.parse(now), delay]).toEqual([delayMs, delayMs]);
  });
});
