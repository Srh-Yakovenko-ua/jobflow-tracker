import type { Notification, UserSettings } from '@jobflow/shared';
import { getQueueToken } from '@nestjs/bullmq';
import type { Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { Clock } from '../common/clock.js';
import {
  NotificationScheduleService,
  NotificationsService,
} from '../modules/notifications/index.js';
import { SettingsService } from '../modules/settings/index.js';
import { NEW_USER_SETTINGS } from './factories.js';
import { NOTIFICATION_ID, SILENCE_NOTIFICATION } from './notifications.js';
import { OLENA_ID } from './service-fixtures.js';
import type { StubQueue } from './stub-queues.js';
import { fixedClock } from './time.js';

export type DeliverySetup = {
  queue: StubQueue;
  now: Date;
  notification?: Notification | undefined;
  settings?: Partial<UserSettings> | undefined;
};

export const NOTIFICATION_CREATED = {
  userId: OLENA_ID,
  notificationId: NOTIFICATION_ID,
  type: 'silence',
} as const;

export async function deliveryOf<Delivery>(
  delivery: Type<Delivery>,
  { queue, now, notification = SILENCE_NOTIFICATION, settings = {} }: DeliverySetup,
): Promise<Delivery> {
  const settingsService = { get: () => Promise.resolve({ ...NEW_USER_SETTINGS, ...settings }) };
  const notifications = {
    find: (userId: string, id: string) =>
      Promise.resolve(userId === OLENA_ID && id === NOTIFICATION_ID ? notification : undefined),
  };
  const moduleRef = await Test.createTestingModule({
    providers: [
      delivery,
      NotificationScheduleService,
      { provide: SettingsService, useValue: settingsService },
      { provide: NotificationsService, useValue: notifications },
      { provide: getQueueToken(queue.name), useValue: queue },
      { provide: Clock, useValue: fixedClock(now) },
    ],
  }).compile();
  return moduleRef.get(delivery);
}
