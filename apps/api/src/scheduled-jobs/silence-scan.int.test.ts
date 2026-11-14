import { silenceNotificationPayloadSchema, type Stage } from '@jobflow/shared';
import { describe, expect, it, vi } from 'vitest';

import { RemindersService, SilenceRepository } from '../modules/reminders/index.js';
import { postStageMove, signedInWithSearch, useStageMoveTestApp } from '../test/applications.js';
import { createApplicationRows } from '../test/factories.js';
import { outboxRows } from '../test/outbox.js';
import {
  notificationsOf,
  ownedStageApplication,
  remindersOf,
  runAt,
  type StageApplicationOwner,
} from '../test/reminders.js';
import { TO_SCREENING } from '../test/service-fixtures.js';
import { daysAfter, minutesAfter, NOW, settableClock } from '../test/time.js';
import { ScheduledJobsModule } from './scheduled-jobs.module.js';
import { ScheduledJobsService } from './scheduled-jobs.service.js';

const DAY_MINUTES = 24 * 60;

const clock = settableClock(NOW);

describe('the silence scan on the database', () => {
  const testApp = useStageMoveTestApp(clock, { imports: [ScheduledJobsModule] });

  async function silentApplication(stage: Stage, silenceDays = 7) {
    const owner = await ownedStageApplication(testApp.prisma, { stage, lastEventAt: NOW });
    await testApp.prisma.userSettings.update({
      where: { userId: owner.userId },
      data: { silenceDays },
    });
    return owner;
  }

  const scanAt = (...instants: Date[]) =>
    runAt(clock, { instants, run: () => testApp.app.get(ScheduledJobsService).silenceScan() });

  async function movedToScreening({ userId, accessToken, applicationId }: StageApplicationOwner) {
    const input = { ...TO_SCREENING, occurredAt: daysAfter(6).toISOString() };
    const response = await postStageMove(testApp.app, { accessToken, id: applicationId, input });
    expect(response.status).toBe(201);
    await testApp.app.get(RemindersService).resolveFollowups(userId, { applicationId });
  }

  const silenceStartsOf = (applicationId: string) =>
    testApp.prisma.timelineEvent.findMany({
      where: { applicationId, kind: 'silence_started' },
      select: { payload: true, occurredAt: true },
    });

  it('writes exactly one follow-up, one notification and one silence_started after 7 days of silence', async () => {
    const { userId, applicationId } = await silentApplication('applied');

    await scanAt(minutesAfter(7 * DAY_MINUTES - 1));
    expect(await remindersOf(testApp.prisma, applicationId)).toEqual([]);

    await scanAt(daysAfter(7), daysAfter(7), minutesAfter(7 * DAY_MINUTES + 15));

    expect(await remindersOf(testApp.prisma, applicationId)).toEqual([
      { type: 'followup', status: 'pending', dueAt: daysAfter(7) },
    ]);
    expect(await notificationsOf(testApp.prisma, userId)).toEqual([
      { type: 'silence', payload: { items: [{ applicationId, company: 'Acme', days: 7 }] } },
    ]);
    expect(await silenceStartsOf(applicationId)).toEqual([
      { payload: { silenceDays: 7 }, occurredAt: daysAfter(7) },
    ]);
  });

  it('groups three applications that fell silent in one scan into one notification', async () => {
    const { userId, searchId } = await signedInWithSearch(testApp.prisma);
    const companies = ['Acme', 'Globex', 'Initech'];
    const applicationIds = await createApplicationRows(testApp.prisma, {
      userId,
      searchId,
      rows: companies.map((company) => ({ company, currentStage: 'applied', lastEventAt: NOW })),
    });

    await scanAt(daysAfter(7), daysAfter(8));

    const [grouped, ...rest] = await notificationsOf(testApp.prisma, userId);
    expect(rest).toEqual([]);
    expect(grouped?.type).toBe('silence');
    expect(silenceNotificationPayloadSchema.parse(grouped?.payload).items).toEqual(
      expect.arrayContaining(
        applicationIds.map((applicationId, index) => ({
          applicationId,
          company: companies[index],
          days: 7,
        })),
      ),
    );
    expect(await outboxRows(testApp.prisma, { eventType: 'notification.created' })).toHaveLength(1);
    const followups = await testApp.prisma.reminder.count({ where: { userId, type: 'followup' } });
    expect(followups).toBe(3);
  });

  it('waits 14 days on the final stage', async () => {
    const { userId, applicationId } = await silentApplication('final');

    await scanAt(daysAfter(7), minutesAfter(14 * DAY_MINUTES - 1));
    expect(await remindersOf(testApp.prisma, applicationId)).toEqual([]);

    await scanAt(daysAfter(14));

    expect(await remindersOf(testApp.prisma, applicationId)).toEqual([
      { type: 'followup', status: 'pending', dueAt: daysAfter(14) },
    ]);
    expect(await notificationsOf(testApp.prisma, userId)).toEqual([
      { type: 'silence', payload: { items: [{ applicationId, company: 'Acme', days: 14 }] } },
    ]);
  });

  it('keeps each user to their own threshold and applications', async () => {
    const olena = await silentApplication('applied');
    const bohdan = await silentApplication('applied', 10);

    await scanAt(daysAfter(7));

    expect(await remindersOf(testApp.prisma, olena.applicationId)).toHaveLength(1);
    expect(await remindersOf(testApp.prisma, bohdan.applicationId)).toEqual([]);
    expect(await notificationsOf(testApp.prisma, bohdan.userId)).toEqual([]);
  });

  it('does not bring back a dismissed follow-up within the same silence', async () => {
    const { userId, applicationId } = await silentApplication('applied');
    await scanAt(daysAfter(7));
    await testApp.prisma.reminder.updateMany({
      where: { applicationId },
      data: { status: 'dismissed' },
    });

    await scanAt(daysAfter(9));

    expect(await remindersOf(testApp.prisma, applicationId)).toEqual([
      { type: 'followup', status: 'dismissed', dueAt: daysAfter(7) },
    ]);
    expect(await notificationsOf(testApp.prisma, userId)).toHaveLength(1);
  });

  it('starts a new silence only a full threshold after a new company event resolved the follow-up', async () => {
    const { userId, applicationId } = await silentApplication('applied');
    await scanAt(daysAfter(7));
    await testApp.prisma.application.update({
      where: { id: applicationId },
      data: { lastEventAt: daysAfter(8) },
    });
    await testApp.app.get(RemindersService).resolveFollowups(userId, { applicationId });

    await scanAt(minutesAfter(15 * DAY_MINUTES - 1));
    expect(await notificationsOf(testApp.prisma, userId)).toHaveLength(1);

    await scanAt(daysAfter(15));

    expect(await remindersOf(testApp.prisma, applicationId)).toEqual([
      { type: 'followup', status: 'done', dueAt: daysAfter(7) },
      { type: 'followup', status: 'pending', dueAt: daysAfter(15) },
    ]);
    expect(await silenceStartsOf(applicationId)).toHaveLength(2);
  });

  it('starts a new silence after a move logged later with an earlier occurredAt than the follow-up', async () => {
    const owner = await silentApplication('applied');
    await scanAt(daysAfter(7));
    clock.at(daysAfter(10));
    await movedToScreening(owner);

    await scanAt(minutesAfter(13 * DAY_MINUTES - 1));
    expect(await notificationsOf(testApp.prisma, owner.userId)).toHaveLength(1);

    await scanAt(daysAfter(13));

    expect(await remindersOf(testApp.prisma, owner.applicationId)).toEqual([
      { type: 'followup', status: 'done', dueAt: daysAfter(7) },
      { type: 'followup', status: 'pending', dueAt: daysAfter(13) },
    ]);
    expect(await silenceStartsOf(owner.applicationId)).toHaveLength(2);
  });

  it("starts no follow-up for another user's application", async () => {
    const olena = await silentApplication('applied');
    const bohdan = await silentApplication('applied');
    const seen = { lastEventAt: NOW, latestEventAt: null };
    const start = { applicationId: olena.applicationId, days: 7, now: daysAfter(7), seen };

    const started = testApp.app.get(RemindersService).startFollowup(bohdan.userId, start);

    await expect(started).resolves.toBe(false);
    expect(await remindersOf(testApp.prisma, olena.applicationId)).toEqual([]);
  });

  it('starts no follow-up when a move commits between the scan read and the insert, and the next silence starts', async () => {
    const owner = await silentApplication('applied');
    const silence = testApp.app.get(SilenceRepository);
    const read = silence.findSilentApplications.bind(silence);
    vi.spyOn(silence, 'findSilentApplications').mockImplementationOnce(async (...call) => {
      const rows = await read(...call);
      await movedToScreening(owner);
      return rows;
    });

    await scanAt(daysAfter(7));
    expect(await remindersOf(testApp.prisma, owner.applicationId)).toEqual([]);

    await scanAt(daysAfter(13));

    expect(await remindersOf(testApp.prisma, owner.applicationId)).toEqual([
      { type: 'followup', status: 'pending', dueAt: daysAfter(13) },
    ]);
    expect(await notificationsOf(testApp.prisma, owner.userId)).toEqual([
      {
        type: 'silence',
        payload: { items: [{ applicationId: owner.applicationId, company: 'Acme', days: 7 }] },
      },
    ]);
  });
});
