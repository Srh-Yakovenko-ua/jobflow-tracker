import type { Stage } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { RemindersService } from '../modules/reminders/index.js';
import { useStageMoveTestApp } from '../test/applications.js';
import { createScheduledEvent } from '../test/factories.js';
import { notificationsOf, ownedStageApplication, remindersOf, runAt } from '../test/reminders.js';
import { minutesAfter, NOW, settableClock } from '../test/time.js';
import { ScheduledJobsModule } from './scheduled-jobs.module.js';
import { ScheduledJobsService } from './scheduled-jobs.service.js';

const INTERVIEW_IN_MINUTES = 180;

const STARTS_AT = minutesAfter(INTERVIEW_IN_MINUTES);

const clock = settableClock(NOW);

const beforeStart = (minutes: number) => minutesAfter(INTERVIEW_IN_MINUTES - minutes);

describe('the interview reminders on the database', () => {
  const testApp = useStageMoveTestApp(clock, { imports: [ScheduledJobsModule] });

  async function plannedInterview(stage: Stage = 'tech_interview') {
    const { userId, applicationId } = await ownedStageApplication(testApp.prisma, {
      stage,
      lastEventAt: NOW,
    });
    const scheduledEventId = await createScheduledEvent(testApp.prisma, {
      applicationId,
      kind: 'tech_interview',
      startsAt: STARTS_AT,
    });
    await testApp.app.get(RemindersService).planInterview(userId, {
      applicationId,
      scheduledEventId,
      startsAt: STARTS_AT,
      now: NOW,
    });
    return { userId, applicationId, scheduledEventId };
  }

  const fireAt = (...instants: Date[]) =>
    runAt(clock, {
      instants,
      run: () => testApp.app.get(ScheduledJobsService).interviewReminders(),
    });

  it('alerts 2 hours and 15 minutes before the interview, once each, then closes the reminder', async () => {
    const { userId, applicationId, scheduledEventId } = await plannedInterview();
    const alert = (minutesBefore: number) => ({
      type: 'interview_soon',
      payload: {
        applicationId,
        scheduledEventId,
        company: 'Acme',
        startsAt: STARTS_AT.toISOString(),
        minutesBefore,
      },
    });

    await fireAt(beforeStart(121));
    expect(await notificationsOf(testApp.prisma, userId)).toEqual([]);

    await fireAt(beforeStart(120), beforeStart(120), beforeStart(16));
    expect(await notificationsOf(testApp.prisma, userId)).toEqual([alert(120)]);
    expect(await remindersOf(testApp.prisma, applicationId)).toEqual([
      { type: 'interview_soon', status: 'pending', dueAt: beforeStart(15) },
    ]);

    await fireAt(beforeStart(15), beforeStart(5));
    expect(await notificationsOf(testApp.prisma, userId)).toEqual([alert(120), alert(15)]);
    expect(await remindersOf(testApp.prisma, applicationId)).toEqual([
      { type: 'interview_soon', status: 'done', dueAt: beforeStart(15) },
    ]);
  });

  it("dismisses a rejected application's due reminder without an alert and still alerts another user", async () => {
    const rejected = await plannedInterview('rejected');
    const open = await plannedInterview();

    await fireAt(beforeStart(120));

    expect(await remindersOf(testApp.prisma, rejected.applicationId)).toEqual([
      { type: 'interview_soon', status: 'dismissed', dueAt: beforeStart(120) },
    ]);
    expect(await notificationsOf(testApp.prisma, rejected.userId)).toEqual([]);
    expect(await notificationsOf(testApp.prisma, open.userId)).toHaveLength(1);
  });
});
