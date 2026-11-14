import type { Notification } from '@jobflow/shared';
import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { Clock } from '../../common/clock.js';
import { NEW_USER_SETTINGS } from '../../test/factories.js';
import {
  interviewSoonAt,
  NOTIFICATION_ID,
  notificationOf,
  SILENCE_NOTIFICATION,
} from '../../test/notifications.js';
import { SILENCE_PUSH } from '../../test/push.js';
import { BOHDAN_ID, MISSING_ID, OLENA_ID } from '../../test/service-fixtures.js';
import { RefusingQueue, SilentQueue, StubQueue } from '../../test/stub-queues.js';
import { fixedClock } from '../../test/time.js';
import { NotificationsService } from '../notifications/index.js';
import { SettingsService } from '../settings/index.js';
import { PushDeliveryService } from './push-delivery.service.js';

const AT_23_KYIV = new Date('2026-11-14T21:00:00.000Z');

const CREATED = { userId: OLENA_ID, notificationId: NOTIFICATION_ID, type: 'silence' } as const;

type Delivery = {
  notification?: Notification;
  notifyPush?: boolean;
  queue?: StubQueue;
};

async function deliveryWith({
  notification = SILENCE_NOTIFICATION,
  notifyPush = true,
  queue = new StubQueue('push'),
}: Delivery = {}) {
  const settings = { get: () => Promise.resolve({ ...NEW_USER_SETTINGS, notifyPush }) };
  const notifications = {
    find: (userId: string, id: string) =>
      Promise.resolve(userId === OLENA_ID && id === NOTIFICATION_ID ? notification : undefined),
  };
  const moduleRef = await Test.createTestingModule({
    providers: [
      PushDeliveryService,
      { provide: SettingsService, useValue: settings },
      { provide: NotificationsService, useValue: notifications },
      { provide: getQueueToken('push'), useValue: queue },
      { provide: Clock, useValue: fixedClock(AT_23_KYIV) },
    ],
  }).compile();
  return { queue, delivery: moduleRef.get(PushDeliveryService) };
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
