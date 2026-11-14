import { describe, expect, it } from 'vitest';

import { NOTIFICATION_ID } from '../../test/notifications.js';
import { ScriptedPushSender } from '../../test/push.js';
import { OLENA_ID } from '../../test/service-fixtures.js';
import { useSubscribedRouter } from '../../test/subscriber.js';
import type { NotificationCreatedPayload } from '../notifications/index.js';
import { PushSubscriber } from './push.subscriber.js';
import { PushDeliveryService } from './push-delivery.service.js';
import { PushSender } from './push-sender.js';

const CREATED: NotificationCreatedPayload = {
  userId: OLENA_ID,
  notificationId: NOTIFICATION_ID,
  type: 'silence',
};

class RecordingDelivery {
  readonly scheduled: NotificationCreatedPayload[] = [];

  schedule(created: NotificationCreatedPayload): Promise<void> {
    this.scheduled.push(created);
    return Promise.resolve();
  }
}

function subscribedWith({ enabled }: { enabled: boolean }) {
  const sender = new ScriptedPushSender();
  sender.enabled = enabled;
  const delivery = new RecordingDelivery();
  const router = useSubscribedRouter([
    PushSubscriber,
    { provide: PushSender, useValue: sender },
    { provide: PushDeliveryService, useValue: delivery },
  ]);
  return { delivery, ...router };
}

describe('PushSubscriber with VAPID keys', () => {
  const { delivery, route } = subscribedWith({ enabled: true });

  it('schedules the push of a created notification', async () => {
    await expect(route('notification.created', CREATED)).resolves.toBe(1);

    expect(delivery.scheduled).toEqual([CREATED]);
  });
});

describe('PushSubscriber without VAPID keys', () => {
  const { delivery, route } = subscribedWith({ enabled: false });

  it('subscribes to nothing, so a created notification schedules no push', async () => {
    await expect(route('notification.created', CREATED)).resolves.toBe(0);

    expect(delivery.scheduled).toEqual([]);
  });
});
