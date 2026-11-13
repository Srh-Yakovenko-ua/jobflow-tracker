import { UnrecoverableError } from 'bullmq';
import { beforeEach, describe, expect, it } from 'vitest';

import { RecordingLivePublisher } from '../../test/live.js';
import { MOVE_EVENT_ID, OLENA_ID, REMINDER_ID } from '../../test/service-fixtures.js';
import { useSubscribedRouter } from '../../test/subscriber.js';
import { LivePublisher } from '../live/index.js';
import { NotificationsSubscriber } from './notifications.subscriber.js';

const CREATED = { userId: OLENA_ID, notificationId: REMINDER_ID, type: 'silence' };

describe('NotificationsSubscriber', () => {
  const live = new RecordingLivePublisher();
  const { log, route } = useSubscribedRouter([
    NotificationsSubscriber,
    { provide: LivePublisher, useValue: live },
  ]);

  beforeEach(() => {
    live.published.length = 0;
  });

  it.each(['silence', 'ai_done', 'insight_unlocked'])(
    'pushes one notification.created with the notification id to the user for a %s notification',
    async (type) => {
      await route('notification.created', { ...CREATED, type });

      expect(live.published).toEqual([
        {
          userId: OLENA_ID,
          event: { type: 'notification.created', data: { notificationId: REMINDER_ID } },
        },
      ]);
    },
  );

  it('fails a notification.created event without its id as unrecoverable and pushes nothing', async () => {
    const payload = { userId: OLENA_ID, type: 'silence' };

    await expect(route('notification.created', payload)).rejects.toBeInstanceOf(UnrecoverableError);

    expect(live.published).toEqual([]);
    expect(log.parsed()).toEqual([
      expect.objectContaining({
        level: 50,
        msg: 'notification event invalid',
        eventId: MOVE_EVENT_ID,
      }),
    ]);
  });
});
