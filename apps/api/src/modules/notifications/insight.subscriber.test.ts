import { beforeEach, describe, expect, it } from 'vitest';

import { RecordingNotifications } from '../../test/notifications.js';
import { APPLICATION_ID, OLENA_ID } from '../../test/service-fixtures.js';
import { useSubscribedRouter } from '../../test/subscriber.js';
import { InsightSubscriber } from './insight.subscriber.js';
import { NotificationsRepository } from './notifications.repository.js';
import { NotificationsService } from './notifications.service.js';

const CREATED = { userId: OLENA_ID, applicationId: APPLICATION_ID };

const UNLOCKED = (applications: number) => ({
  userId: OLENA_ID,
  type: 'insight_unlocked',
  payload: { applications },
});

describe('InsightSubscriber', () => {
  const notifications = new RecordingNotifications();
  const applications = { count: 0 };
  const { route } = useSubscribedRouter([
    InsightSubscriber,
    { provide: NotificationsService, useValue: notifications },
    {
      provide: NotificationsRepository,
      useValue: { countApplications: () => Promise.resolve(applications.count) },
    },
  ]);

  beforeEach(() => {
    notifications.notifications.length = 0;
  });

  it.each([
    { count: 9, recorded: [] },
    { count: 10, recorded: [UNLOCKED(10)] },
  ])(
    'records $recorded.length insight_unlocked when a new application brings the user to $count',
    async ({ count, recorded }) => {
      applications.count = count;

      await route('application.created', CREATED);

      expect(notifications.notifications).toEqual(recorded);
    },
  );

  it('records no second insight_unlocked at 11 applications', async () => {
    applications.count = 10;
    await route('application.created', CREATED);
    applications.count = 11;

    await route('application.created', CREATED);

    expect(notifications.notifications).toEqual([UNLOCKED(10)]);
  });

  it.each([
    { fields: ['isDraft'], recorded: [UNLOCKED(10)] },
    { fields: ['aiParsed', 'isDraft'], recorded: [UNLOCKED(10)] },
    { fields: ['company'], recorded: [] },
  ])(
    'records $recorded.length insight_unlocked for an update of $fields',
    async ({ fields, recorded }) => {
      applications.count = 10;

      await route('application.updated', { ...CREATED, fields });

      expect(notifications.notifications).toEqual(recorded);
    },
  );
});
