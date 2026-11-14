import { describe, expect, it } from 'vitest';

import {
  buildNotification,
  NOTIFICATION_NOW,
  type NotificationSeed,
} from '@/test/notification-fixtures';

import { notificationDaysOf } from './notification-days';

const INSIGHT: Pick<NotificationSeed, 'type' | 'payload'> = {
  type: 'insight_unlocked',
  payload: { applications: 10 },
};

function createdAt(serial: number, at: string) {
  return buildNotification({ serial, createdAt: at, ...INSIGHT });
}

const LATE_KYIV_EVENING = createdAt(1, '2026-11-13T22:30:00.000Z');
const KYIV_MORNING = createdAt(2, '2026-11-14T06:00:00.000Z');
const YESTERDAY_NOON = createdAt(3, '2026-11-13T10:00:00.000Z');
const LAST_WEEK = createdAt(4, '2026-11-06T10:00:00.000Z');
const LAST_YEAR = createdAt(5, '2025-12-30T10:00:00.000Z');

function daysIn(timeZone: string) {
  return notificationDaysOf({
    notifications: [KYIV_MORNING, LATE_KYIV_EVENING, YESTERDAY_NOON, LAST_WEEK, LAST_YEAR],
    zone: { now: NOTIFICATION_NOW, timeZone },
  }).map((day) => ({ label: day.label, ids: day.notifications.map(({ id }) => id) }));
}

describe('notificationDaysOf', () => {
  it('groups rows by the user day in Kyiv, so a late evening in UTC lands on the Kyiv today', () => {
    expect(daysIn('Europe/Kyiv')).toEqual([
      { label: 'Сьогодні', ids: [KYIV_MORNING.id, LATE_KYIV_EVENING.id] },
      { label: 'Вчора', ids: [YESTERDAY_NOON.id] },
      { label: '06.11', ids: [LAST_WEEK.id] },
      { label: '30.12.2025', ids: [LAST_YEAR.id] },
    ]);
  });

  it('the same rows in UTC put the evening on yesterday', () => {
    expect(daysIn('UTC').slice(0, 2)).toEqual([
      { label: 'Сьогодні', ids: [KYIV_MORNING.id] },
      { label: 'Вчора', ids: [LATE_KYIV_EVENING.id, YESTERDAY_NOON.id] },
    ]);
  });

  it('returns no day for no rows', () => {
    expect(
      notificationDaysOf({ notifications: [], zone: { now: NOTIFICATION_NOW, timeZone: 'UTC' } }),
    ).toEqual([]);
  });
});
