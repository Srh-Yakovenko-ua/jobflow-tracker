import { describe, expect, it } from 'vitest';

import { FAKE_TRANSACTION, fakeTransactionModule } from '../../test/fake-prisma.js';
import type { ByUser } from '../../test/recorded-events.js';
import { FakeRemindersRepository } from '../../test/reminders.js';
import {
  APPLICATION_ID,
  OLENA_ID,
  REMINDER_ID,
  SCHEDULED_EVENT_ID,
} from '../../test/service-fixtures.js';
import { minutesAfter, NOW } from '../../test/time.js';
import {
  type DueInterviewRow,
  InterviewAlertsRepository,
  type RearmInterview,
} from './interview-alerts.repository.js';
import { InterviewAlertsService } from './interview-alerts.service.js';
import { RemindersRepository } from './reminders.repository.js';

type StoredAlert = ByUser<DueInterviewRow> & { status: string };

type AlertFields = {
  startsAt: Date;
  dueAt?: Date;
  stage?: DueInterviewRow['application']['currentStage'];
  eventStatus?: 'planned' | 'done' | 'cancelled';
};

class FakeInterviewAlertsRepository {
  readonly rows: StoredAlert[] = [];

  losesRace = false;

  findDueInterviews(userId: string, now: Date): Promise<DueInterviewRow[]> {
    const due = this.rows.filter(
      (row) => row.userId === userId && row.status === 'pending' && row.dueAt <= now,
    );
    return Promise.resolve(due.map((row) => ({ ...row })));
  }

  rearmInterview(userId: string, { id, dueAt, next, tx }: RearmInterview): Promise<number> {
    const row = this.rows.find(
      (candidate) =>
        candidate.userId === userId &&
        candidate.id === id &&
        candidate.status === 'pending' &&
        candidate.dueAt.getTime() === dueAt.getTime(),
    );
    if (row === undefined || this.losesRace || !Object.is(tx, FAKE_TRANSACTION)) {
      return Promise.resolve(0);
    }
    Object.assign(row, next);
    return Promise.resolve(1);
  }
}

const alertRow = ({
  startsAt,
  dueAt = NOW,
  stage = 'tech_interview',
  eventStatus = 'planned',
}: AlertFields): StoredAlert => ({
  userId: OLENA_ID,
  id: REMINDER_ID,
  applicationId: APPLICATION_ID,
  scheduledEventId: SCHEDULED_EVENT_ID,
  status: 'pending',
  dueAt,
  scheduledEvent: { id: SCHEDULED_EVENT_ID, startsAt, status: eventStatus },
  application: { company: 'Ромашка', currentStage: stage, deletedAt: null },
});

async function alertsOf(fields: AlertFields) {
  const alerts = new FakeInterviewAlertsRepository();
  const reminders = new FakeRemindersRepository();
  alerts.rows.push(alertRow(fields));
  const moduleRef = await fakeTransactionModule({
    providers: [InterviewAlertsService, InterviewAlertsRepository, RemindersRepository],
    now: NOW,
  })
    .overrideProvider(InterviewAlertsRepository)
    .useValue(alerts)
    .overrideProvider(RemindersRepository)
    .useValue(reminders)
    .compile();
  return { alerts, reminders, service: moduleRef.get(InterviewAlertsService) };
}

const stateOf = ({ status, dueAt }: StoredAlert) => [status, dueAt.toISOString()];

describe('InterviewAlertsService.fireDue', () => {
  it.each([
    { case: 'on the 2 hour mark', minutesAway: 120, dueAt: NOW },
    { case: 'on a tick 2 minutes late', minutesAway: 118, dueAt: minutesAfter(-2) },
  ])('alerts $case and re-arms the row to the 15 minute mark', async ({ minutesAway, dueAt }) => {
    const startsAt = minutesAfter(minutesAway);
    const { alerts, reminders, service } = await alertsOf({ startsAt, dueAt });

    await expect(service.fireDue(OLENA_ID, NOW)).resolves.toBe(1);

    expect(alerts.rows.map(stateOf)).toEqual([
      ['pending', new Date(startsAt.getTime() - 15 * 60_000).toISOString()],
    ]);
    expect(reminders.notifications).toEqual([
      {
        userId: OLENA_ID,
        type: 'interview_soon',
        payload: {
          applicationId: APPLICATION_ID,
          scheduledEventId: SCHEDULED_EVENT_ID,
          company: 'Ромашка',
          startsAt: startsAt.toISOString(),
          minutesBefore: minutesAway,
        },
        tx: FAKE_TRANSACTION,
      },
    ]);
  });

  it('alerts on the 15 minute mark and closes the row as done', async () => {
    const { alerts, reminders, service } = await alertsOf({ startsAt: minutesAfter(15) });

    await expect(service.fireDue(OLENA_ID, NOW)).resolves.toBe(1);

    expect(alerts.rows.map(stateOf)).toEqual([['done', NOW.toISOString()]]);
    expect(reminders.notifications.map(({ payload }) => payload)).toEqual([
      expect.objectContaining({ minutesBefore: 15 }),
    ]);
  });

  it.each([
    { case: 'an interview that has started', fields: { startsAt: NOW }, status: 'done' },
    {
      case: 'a rejected application',
      fields: { startsAt: minutesAfter(120), stage: 'rejected' },
      status: 'dismissed',
    },
    {
      case: 'a cancelled event',
      fields: { startsAt: minutesAfter(120), eventStatus: 'cancelled' },
      status: 'dismissed',
    },
  ] as const)('closes the row of $case as $status without an alert', async ({ fields, status }) => {
    const { alerts, reminders, service } = await alertsOf(fields);

    await expect(service.fireDue(OLENA_ID, NOW)).resolves.toBe(0);

    expect(alerts.rows.map(stateOf)).toEqual([[status, NOW.toISOString()]]);
    expect(reminders.notifications).toEqual([]);
  });

  it('writes no alert when another tick has already moved the row', async () => {
    const { alerts, reminders, service } = await alertsOf({ startsAt: minutesAfter(120) });
    alerts.losesRace = true;

    await expect(service.fireDue(OLENA_ID, NOW)).resolves.toBe(0);

    expect(reminders.notifications).toEqual([]);
  });
});
