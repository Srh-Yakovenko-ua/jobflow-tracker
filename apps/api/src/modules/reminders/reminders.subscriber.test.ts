import { UnrecoverableError } from 'bullmq';
import { beforeEach, describe, expect, it } from 'vitest';

import { Clock } from '../../common/clock.js';
import { APPLICATION_ID, MOVE_EVENT_ID, OLENA_ID } from '../../test/service-fixtures.js';
import { useSubscribedRouter } from '../../test/subscriber.js';
import { fixedClock, NOW } from '../../test/time.js';
import { RemindersService, type ResolveFollowups } from './reminders.service.js';
import { RemindersSubscriber } from './reminders.subscriber.js';
import { SilenceScanService } from './silence-scan.service.js';

const STAGE_CHANGED = {
  userId: OLENA_ID,
  applicationId: APPLICATION_ID,
  fromStage: 'applied',
  toStage: 'screening',
  reasonCode: null,
  compensatesEventId: null,
};

class RecordingReminders {
  readonly calls: unknown[][] = [];

  resolveFollowups(userId: string, followups: ResolveFollowups): Promise<number> {
    this.calls.push(['resolveFollowups', userId, followups]);
    return Promise.resolve(1);
  }

  startSilence(userId: string, now: Date) {
    this.calls.push(['startSilence', userId, now]);
    return Promise.resolve({ started: 0, alreadyStarted: 0 });
  }
}

describe('RemindersSubscriber', () => {
  const reminders = new RecordingReminders();
  const { log, route } = useSubscribedRouter([
    RemindersSubscriber,
    { provide: RemindersService, useValue: reminders },
    { provide: SilenceScanService, useValue: reminders },
    { provide: Clock, useValue: fixedClock(NOW) },
  ]);

  beforeEach(() => {
    reminders.calls.length = 0;
  });

  it('resolves the follow-ups of an application whose stage changed', async () => {
    await route('application.stage_changed', STAGE_CHANGED);

    expect(reminders.calls).toEqual([
      ['resolveFollowups', OLENA_ID, { applicationId: APPLICATION_ID }],
    ]);
  });

  it.each([
    { fields: ['silenceDays'], calls: [['startSilence', OLENA_ID, NOW]] },
    { fields: ['theme', 'silenceDays'], calls: [['startSilence', OLENA_ID, NOW]] },
    { fields: ['autoGhostDays'], calls: [] },
  ])('runs the silence scan now for a settings change of $fields', async ({ fields, calls }) => {
    await route('settings.changed', { userId: OLENA_ID, fields });

    expect(reminders.calls).toEqual(calls);
  });

  it.each([
    { type: 'application.stage_changed', payload: { userId: OLENA_ID } },
    { type: 'settings.changed', payload: { userId: OLENA_ID, fields: [] } },
  ])(
    'fails an invalid $type event as unrecoverable and runs nothing',
    async ({ type, payload }) => {
      await expect(route(type, payload)).rejects.toBeInstanceOf(UnrecoverableError);

      expect(reminders.calls).toEqual([]);
      expect(log.parsed()).toEqual([
        expect.objectContaining({
          level: 50,
          msg: 'reminders event invalid',
          eventId: MOVE_EVENT_ID,
        }),
      ]);
    },
  );
});
