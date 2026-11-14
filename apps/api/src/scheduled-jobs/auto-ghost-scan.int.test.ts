import { applicationResponseSchema, errorResponseSchema } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { postStageMove, stageEventsOf, useStageMoveTestApp } from '../test/applications.js';
import {
  notificationsOf,
  ownedStageApplication,
  runAt,
  type StageApplication,
  type StageApplicationOwner,
} from '../test/reminders.js';
import { DAY_MINUTES, daysAfter, minutesAfter, NOW, settableClock } from '../test/time.js';
import { AutoGhostScanService } from './auto-ghost-scan.service.js';
import { ScheduledJobsModule } from './scheduled-jobs.module.js';

const clock = settableClock(NOW);

const GHOST_EVENT = {
  fromStage: 'applied',
  toStage: 'ghosted',
  reasonCode: 'silence_timeout',
  occurredAt: daysAfter(30),
  compensatesEventId: null,
};

const REVIVE = { fromStage: 'ghosted', toStage: 'applied' };

const NO_TRAIL = { stageEvents: [], notifications: [] };

describe('the auto ghost scan on the database', () => {
  const testApp = useStageMoveTestApp(clock, { imports: [ScheduledJobsModule] });

  const silentApplication = (application: Partial<StageApplication> = {}) =>
    ownedStageApplication(testApp.prisma, { stage: 'applied', lastEventAt: NOW, ...application });

  const scanAt = (...instants: Date[]) =>
    runAt(clock, { instants, run: () => testApp.app.get(AutoGhostScanService).scan() });

  const trailOf = async ({ userId, applicationId }: StageApplicationOwner) => ({
    stageEvents: await stageEventsOf(testApp.prisma, applicationId),
    notifications: await notificationsOf(testApp.prisma, userId),
  });

  it('moves nothing on day 29 and moves the card to ghosted exactly once from day 30', async () => {
    const owner = await silentApplication();

    await scanAt(minutesAfter(30 * DAY_MINUTES - 1));
    expect(await trailOf(owner)).toEqual(NO_TRAIL);

    await scanAt(daysAfter(30), daysAfter(30), minutesAfter(30 * DAY_MINUTES + 60));

    expect(await trailOf(owner)).toEqual({
      stageEvents: [GHOST_EVENT],
      notifications: [
        {
          type: 'auto_ghosted',
          payload: {
            items: [{ applicationId: owner.applicationId, company: 'Acme', days: 30 }],
            autoGhostDays: 30,
          },
        },
      ],
    });
  });

  it('moves nothing for a user who switched auto ghosting off', async () => {
    const owner = await silentApplication();
    await testApp.prisma.userSettings.update({
      where: { userId: owner.userId },
      data: { autoGhostDays: null },
    });

    await scanAt(daysAfter(90));

    expect(await trailOf(owner)).toEqual(NO_TRAIL);
  });

  it.each<{ case: string; application: Partial<StageApplication> }>([
    { case: 'a rejected', application: { stage: 'rejected' } },
    { case: 'a draft', application: { row: { isDraft: true } } },
    { case: 'a deleted', application: { row: { deletedAt: NOW } } },
  ])('leaves $case application where it is', async ({ application }) => {
    const owner = await silentApplication(application);

    await scanAt(daysAfter(90));

    expect(await trailOf(owner)).toEqual(NO_TRAIL);
  });

  it('lets the user revive a ghosted card to its previous stage, keeps the history and does not ghost it again', async () => {
    const { accessToken, applicationId } = await silentApplication();
    await scanAt(daysAfter(30));
    clock.at(daysAfter(31));

    const response = await postStageMove(testApp.app, {
      accessToken,
      id: applicationId,
      input: REVIVE,
    });
    await scanAt(minutesAfter(31 * DAY_MINUTES + 60));

    expect(response.status).toBe(201);
    expect(applicationResponseSchema.parse(response.body).currentStage).toBe('applied');
    expect(await stageEventsOf(testApp.prisma, applicationId)).toEqual([
      GHOST_EVENT,
      { ...REVIVE, reasonCode: null, occurredAt: daysAfter(31), compensatesEventId: null },
    ]);
  });

  it('refuses a revive of a ghosted card to another stage with 409 illegal_transition', async () => {
    const { accessToken, applicationId } = await silentApplication();
    await scanAt(daysAfter(30));

    const response = await postStageMove(testApp.app, {
      accessToken,
      id: applicationId,
      input: { fromStage: 'ghosted', toStage: 'screening' },
    });

    expect(response.status).toBe(409);
    expect(errorResponseSchema.parse(response.body)).toMatchObject({
      type: 'illegal_transition',
    });
    expect(await stageEventsOf(testApp.prisma, applicationId)).toEqual([GHOST_EVENT]);
  });
});
