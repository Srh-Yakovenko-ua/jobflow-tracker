import { UnrecoverableError } from 'bullmq';
import { beforeEach, describe, expect, it } from 'vitest';

import { RecordingLivePublisher } from '../../test/live.js';
import { APPLICATION_ID, MOVE_EVENT_ID, OLENA_ID } from '../../test/service-fixtures.js';
import { useSubscribedRouter } from '../../test/subscriber.js';
import { LivePublisher } from '../live/index.js';
import { ApplicationLiveSubscriber } from './application-live.subscriber.js';

const UPDATED = { userId: OLENA_ID, applicationId: APPLICATION_ID, fields: ['company', 'stack'] };

describe('ApplicationLiveSubscriber', () => {
  const live = new RecordingLivePublisher();
  const { log, route } = useSubscribedRouter([
    ApplicationLiveSubscriber,
    { provide: LivePublisher, useValue: live },
  ]);

  beforeEach(() => {
    live.published.length = 0;
  });

  it("publishes application.updated with the application and its changed fields to the event's user", async () => {
    await route('application.updated', UPDATED);

    expect(live.published).toEqual([
      {
        userId: OLENA_ID,
        event: {
          type: 'application.updated',
          data: { applicationId: APPLICATION_ID, fields: ['company', 'stack'] },
        },
      },
    ]);
  });

  it.each(['application.created', 'application.stage_changed'])(
    'publishes nothing for %s',
    async (type) => {
      await route(type, UPDATED);

      expect(live.published).toEqual([]);
    },
  );

  it('fails an application.updated event without fields as unrecoverable and publishes nothing', async () => {
    const payload = { userId: OLENA_ID, applicationId: APPLICATION_ID };

    await expect(route('application.updated', payload)).rejects.toBeInstanceOf(UnrecoverableError);

    expect(live.published).toEqual([]);
    expect(log.parsed()).toEqual([
      expect.objectContaining({
        level: 50,
        msg: 'application event invalid',
        eventId: MOVE_EVENT_ID,
      }),
    ]);
  });
});
