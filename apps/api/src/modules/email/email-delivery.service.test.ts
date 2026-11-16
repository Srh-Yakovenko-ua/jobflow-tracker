import type { Notification, UserSettings } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { deliveryOf, NOTIFICATION_CREATED } from '../../test/delivery.js';
import {
  interviewSoonAt,
  MONTHLY_SUMMARY_NOTIFICATION,
  NOTIFICATION_ID,
} from '../../test/notifications.js';
import { BOHDAN_ID, MISSING_ID, OLENA_ID } from '../../test/service-fixtures.js';
import { StubQueue, unreachableQueues } from '../../test/stub-queues.js';
import { EmailDeliveryService } from './email-delivery.service.js';

const AT_23_KYIV = new Date('2026-11-14T21:00:00.000Z');

const AT_NOON_KYIV = new Date('2026-11-14T10:00:00.000Z');

const SUMMARY_CREATED = { ...NOTIFICATION_CREATED, type: 'monthly_summary_ready' } as const;

type Delivery = {
  notification?: Notification;
  settings?: Partial<UserSettings>;
  queue?: StubQueue;
  now?: Date;
};

async function deliveryWith({
  notification = MONTHLY_SUMMARY_NOTIFICATION,
  settings,
  queue = new StubQueue('notifications'),
  now = AT_23_KYIV,
}: Delivery = {}) {
  const delivery = await deliveryOf(EmailDeliveryService, { queue, now, notification, settings });
  return { queue, delivery };
}

describe('EmailDeliveryService.schedule', () => {
  it('holds a summary email of 23:00 Kyiv for 9 hours under the notification id, with ids only', async () => {
    const { queue, delivery } = await deliveryWith();

    await delivery.schedule(SUMMARY_CREATED);

    expect(queue.jobs).toEqual([
      {
        id: NOTIFICATION_ID,
        name: 'email.send',
        data: { userId: OLENA_ID, notificationId: NOTIFICATION_ID },
      },
    ]);
    expect(queue.addOptions).toEqual([{ jobId: NOTIFICATION_ID, delay: 32_400_000 }]);
  });

  it('queues a summary email of noon Kyiv at once', async () => {
    const { queue, delivery } = await deliveryWith({ now: AT_NOON_KYIV });

    await delivery.schedule(SUMMARY_CREATED);

    expect(queue.addOptions).toEqual([{ jobId: NOTIFICATION_ID, delay: 0 }]);
  });

  it.each([
    { case: 'with email turned off', fields: { settings: { notifyEmail: false } } },
    {
      case: 'with summary emails unsubscribed',
      fields: { settings: { emailMonthlySummary: false } },
    },
    {
      case: 'for an interview_soon alert',
      fields: { notification: interviewSoonAt(AT_23_KYIV) },
      created: { ...NOTIFICATION_CREATED, type: 'interview_soon' as const },
    },
    {
      case: 'for a notification of another user',
      fields: {},
      created: { ...SUMMARY_CREATED, userId: BOHDAN_ID },
    },
    {
      case: 'for a notification that is gone',
      fields: {},
      created: { ...SUMMARY_CREATED, notificationId: MISSING_ID },
    },
  ])('queues no email $case', async ({ fields, created = SUMMARY_CREATED }) => {
    const { queue, delivery } = await deliveryWith(fields);

    await delivery.schedule(created);

    expect(queue.jobs).toEqual([]);
  });

  it('still emails a summary when only silence emails are unsubscribed', async () => {
    const { queue, delivery } = await deliveryWith({ settings: { emailSilence: false } });

    await delivery.schedule(SUMMARY_CREATED);

    expect(queue.jobs).toHaveLength(1);
  });

  it.each(unreachableQueues('notifications'))(
    'rejects so the event retries when the queue $case',
    async ({ queue, error }) => {
      const { delivery } = await deliveryWith({ queue });

      await expect(delivery.schedule(SUMMARY_CREATED)).rejects.toThrow(error);
    },
  );
});
