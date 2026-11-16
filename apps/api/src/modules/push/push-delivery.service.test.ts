import type { Notification } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { deliveryOf, NOTIFICATION_CREATED as CREATED } from '../../test/delivery.js';
import {
  interviewPrepReadyFor,
  interviewSoonAt,
  NOTIFICATION_ID,
  notificationOf,
} from '../../test/notifications.js';
import { SILENCE_PUSH } from '../../test/push.js';
import { BOHDAN_ID, MISSING_ID, OLENA_ID } from '../../test/service-fixtures.js';
import { RefusingQueue, SilentQueue, StubQueue } from '../../test/stub-queues.js';
import { PushDeliveryService } from './push-delivery.service.js';

const AT_23_KYIV = new Date('2026-11-14T21:00:00.000Z');

type Delivery = {
  notification?: Notification;
  notifyPush?: boolean;
  queue?: StubQueue;
};

async function deliveryWith({
  notification,
  notifyPush = true,
  queue = new StubQueue('push'),
}: Delivery = {}) {
  const delivery = await deliveryOf(PushDeliveryService, {
    queue,
    now: AT_23_KYIV,
    notification,
    settings: { notifyPush },
  });
  return { queue, delivery };
}

describe('PushDeliveryService.schedule', () => {
  it('holds a silence reminder of 23:00 Kyiv for 9 hours, until 08:00, under the notification id', async () => {
    const { queue, delivery } = await deliveryWith();

    await delivery.schedule(CREATED);

    expect(queue.jobs).toEqual([
      {
        id: NOTIFICATION_ID,
        name: 'push.send',
        data: { userId: OLENA_ID, message: SILENCE_PUSH },
      },
    ]);
    expect(queue.addOptions).toEqual([{ jobId: NOTIFICATION_ID, delay: 32_400_000 }]);
  });

  it('sends an interview reminder of 23:00 Kyiv starting in 60 min at once', async () => {
    const notification = interviewSoonAt(new Date('2026-11-14T22:00:00.000Z'));
    const { queue, delivery } = await deliveryWith({ notification });

    await delivery.schedule({ ...CREATED, type: 'interview_soon' });

    expect(queue.addOptions).toEqual([{ jobId: NOTIFICATION_ID, delay: 0 }]);
  });

  it('a pack pushed the next morning says Сьогодні', async () => {
    const notification = {
      ...interviewPrepReadyFor(new Date('2026-11-15T09:00:00.000Z')),
      createdAt: '2026-11-14T20:30:00.000Z',
    };
    const { queue, delivery } = await deliveryWith({ notification });

    await delivery.schedule({ ...CREATED, type: 'interview_prep_ready' });

    expect(queue.jobs[0]?.data).toMatchObject({
      message: { title: "Сьогодні техінтерв'ю в Acme" },
    });
    expect(queue.addOptions).toEqual([{ jobId: NOTIFICATION_ID, delay: 32_400_000 }]);
  });

  it.each([
    { case: 'with push turned off', fields: { notifyPush: false }, created: CREATED },
    {
      case: 'for an ai_done notification',
      fields: {
        notification: notificationOf({
          type: 'ai_done',
          payload: { aiJobId: MISSING_ID, kind: 'vacancy_parse' },
        }),
      },
      created: { ...CREATED, type: 'ai_done' as const },
    },
    {
      case: 'for a notification of another user',
      fields: {},
      created: { ...CREATED, userId: BOHDAN_ID },
    },
    {
      case: 'for a notification that is gone',
      fields: {},
      created: { ...CREATED, notificationId: MISSING_ID },
    },
  ])('queues no push $case', async ({ fields, created }) => {
    const { queue, delivery } = await deliveryWith(fields);

    await delivery.schedule(created);

    expect(queue.jobs).toEqual([]);
  });

  it.each([
    { case: 'refuses it', queue: new RefusingQueue('push'), error: 'Connection is closed.' },
    { case: 'never answers', queue: new SilentQueue('push'), error: 'timed out after 2000 ms' },
  ])('rejects so the event retries when the queue $case', async ({ queue, error }) => {
    const { delivery } = await deliveryWith({ queue });

    await expect(delivery.schedule(CREATED)).rejects.toThrow(error);
  });
});
