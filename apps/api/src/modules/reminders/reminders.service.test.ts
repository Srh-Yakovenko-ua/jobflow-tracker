import { describe, expect, it } from 'vitest';

import { FAKE_TRANSACTION, fakeTransactionModule } from '../../test/fake-prisma.js';
import { TimelineRecorder } from '../../test/recorded-events.js';
import {
  FakeRemindersRepository,
  type StoredReminder,
  storedReminder,
} from '../../test/reminders.js';
import {
  APPLICATION_ID,
  BOHDAN_ID,
  MISSING_ID,
  OLENA_ID,
  REMINDER_ID,
  SCHEDULED_EVENT_ID,
} from '../../test/service-fixtures.js';
import { daysBefore, minutesAfter, NOW } from '../../test/time.js';
import { TimelineService } from '../events/index.js';
import { RemindersRepository } from './reminders.repository.js';
import { RemindersService } from './reminders.service.js';
import type { SilenceMark } from './silence-mark.js';

const INTERVIEW = { applicationId: APPLICATION_ID, scheduledEventId: SCHEDULED_EVENT_ID };

const SECOND_REMINDER_ID = '0199f0a0-0000-7000-8000-000000000103';

const OTHER_APPLICATION_ID = '0199f0a0-0000-7000-8000-0000000000c3';

async function serviceWithFake(rows: StoredReminder[] = []) {
  const repository = new FakeRemindersRepository();
  const timeline = new TimelineRecorder();
  repository.rows.push(...rows);
  const moduleRef = await fakeTransactionModule({
    providers: [RemindersService, RemindersRepository, TimelineService],
    now: NOW,
  })
    .overrideProvider(RemindersRepository)
    .useValue(repository)
    .overrideProvider(TimelineService)
    .useValue(timeline)
    .compile();
  return { repository, timeline, service: moduleRef.get(RemindersService) };
}

const interviewRow = (fields: Partial<StoredReminder>) =>
  storedReminder({ type: 'interview_soon', scheduledEventId: SCHEDULED_EVENT_ID, ...fields });

describe('RemindersService.planInterview', () => {
  it('dismisses the active interview reminder and arms one pending row 2 hours ahead', async () => {
    const { repository, service } = await serviceWithFake([
      interviewRow({ status: 'snoozed', dueAt: minutesAfter(5) }),
      interviewRow({ status: 'done', dueAt: minutesAfter(-60) }),
    ]);

    await service.planInterview(OLENA_ID, { ...INTERVIEW, startsAt: minutesAfter(180), now: NOW });

    expect(repository.rows.map(({ status, dueAt }) => [status, dueAt.toISOString()])).toEqual([
      ['dismissed', '2026-10-22T09:05:00.000Z'],
      ['done', '2026-10-22T08:00:00.000Z'],
      ['pending', '2026-10-22T10:00:00.000Z'],
    ]);
  });

  it('arms no reminder for an interview 10 minutes away', async () => {
    const { repository, service } = await serviceWithFake();

    await service.planInterview(OLENA_ID, { ...INTERVIEW, startsAt: minutesAfter(10), now: NOW });

    expect(repository.rows).toEqual([]);
  });
});

describe('RemindersService.closeInterview', () => {
  it('closes the active interview reminder with the given status and arms none', async () => {
    const { repository, service } = await serviceWithFake([
      interviewRow({ status: 'pending', dueAt: minutesAfter(30) }),
    ]);

    await service.closeInterview(OLENA_ID, { ...INTERVIEW, status: 'done' });

    expect(repository.rows.map(({ status }) => status)).toEqual(['done']);
  });
});

describe('RemindersService.list', () => {
  it("answers the user's active reminders with ISO dates and the application's company and stage", async () => {
    const { service } = await serviceWithFake([
      storedReminder({
        id: SECOND_REMINDER_ID,
        status: 'snoozed',
        dueAt: daysBefore(1),
        snoozedUntil: minutesAfter(60),
      }),
      storedReminder({ userId: BOHDAN_ID, id: MISSING_ID }),
      storedReminder({ dueAt: daysBefore(2) }),
    ]);

    await expect(service.list(OLENA_ID)).resolves.toEqual({
      items: [
        {
          id: REMINDER_ID,
          applicationId: APPLICATION_ID,
          company: 'Ромашка',
          stage: 'applied',
          type: 'followup',
          status: 'pending',
          scheduledEventId: null,
          dueAt: '2026-10-20T09:00:00.000Z',
          snoozedUntil: null,
        },
        expect.objectContaining({
          id: SECOND_REMINDER_ID,
          status: 'snoozed',
          dueAt: '2026-10-21T09:00:00.000Z',
          snoozedUntil: '2026-10-22T10:00:00.000Z',
        }),
      ],
    });
  });
});

describe('RemindersService closing a reminder', () => {
  it.each([
    { action: 'done', close: (service: RemindersService) => service.done(OLENA_ID, REMINDER_ID) },
    {
      action: 'dismissed',
      close: (service: RemindersService) => service.dismiss(OLENA_ID, REMINDER_ID),
    },
  ])('marks a pending reminder $action and answers it', async ({ action, close }) => {
    const { repository, service } = await serviceWithFake([storedReminder()]);

    await expect(close(service)).resolves.toMatchObject({ id: REMINDER_ID, status: action });
    expect(repository.rows.map(({ status }) => status)).toEqual([action]);
  });

  it('snoozes a reminder until now plus the given days, also when it is already snoozed', async () => {
    const { service } = await serviceWithFake([
      storedReminder({ status: 'snoozed', snoozedUntil: minutesAfter(30) }),
    ]);

    await expect(service.snooze(OLENA_ID, { id: REMINDER_ID, days: 3 })).resolves.toMatchObject({
      status: 'snoozed',
      snoozedUntil: '2026-10-25T09:00:00.000Z',
    });
  });

  it.each([
    { case: 'a missing id', userId: OLENA_ID, id: MISSING_ID },
    { case: "another user's reminder", userId: BOHDAN_ID, id: REMINDER_ID },
  ])('answers 404 for $case and changes nothing', async ({ userId, id }) => {
    const { repository, service } = await serviceWithFake([storedReminder()]);

    await expect(service.done(userId, id)).rejects.toMatchObject({
      body: { status: 404, detail: 'Reminder not found' },
    });
    expect(repository.rows.map(({ status }) => status)).toEqual(['pending']);
  });

  it.each(['done', 'dismissed'] as const)(
    'answers 409 for a reminder that is already %s',
    async (status) => {
      const { service } = await serviceWithFake([storedReminder({ status })]);

      await expect(service.snooze(OLENA_ID, { id: REMINDER_ID, days: 1 })).rejects.toMatchObject({
        body: { status: 409, detail: 'Reminder is already closed' },
      });
    },
  );
});

describe('RemindersService.resolveFollowups', () => {
  it("marks the application's active follow-up done and leaves its interview reminder and other applications", async () => {
    const { repository, service } = await serviceWithFake([
      storedReminder({ status: 'snoozed' }),
      interviewRow({ id: SECOND_REMINDER_ID }),
      storedReminder({ id: MISSING_ID, applicationId: OTHER_APPLICATION_ID }),
      storedReminder({ id: BOHDAN_ID, userId: BOHDAN_ID }),
    ]);

    await expect(
      service.resolveFollowups(OLENA_ID, { applicationId: APPLICATION_ID }),
    ).resolves.toBe(1);
    expect(repository.rows.map(({ status }) => status)).toEqual([
      'done',
      'pending',
      'pending',
      'pending',
    ]);
  });
});

describe('RemindersService.startFollowup', () => {
  const SEEN: SilenceMark = { lastEventAt: daysBefore(7), latestEventAt: daysBefore(9) };

  async function startedOver(seen: SilenceMark) {
    const { repository, timeline, service } = await serviceWithFake();
    repository.silenceMarks.push({
      userId: OLENA_ID,
      applicationId: APPLICATION_ID,
      lastEventAt: daysBefore(7),
      stageEvents: [{ createdAt: daysBefore(9) }],
    });
    const start = { applicationId: APPLICATION_ID, days: 7, now: NOW, seen };
    return { repository, timeline, started: await service.startFollowup(OLENA_ID, start) };
  }

  it.each([
    { case: 'last event', seen: { ...SEEN, lastEventAt: daysBefore(8) } },
    { case: 'latest stage event', seen: { ...SEEN, latestEventAt: null } },
  ])('writes nothing when the $case changed after the scan read it', async ({ seen }) => {
    const { repository, timeline, started } = await startedOver(seen);

    expect([started, repository.rows, timeline.events]).toEqual([false, [], []]);
  });

  it('writes a follow-up due now and silence_started in one transaction', async () => {
    const { repository, timeline, started } = await startedOver(SEEN);

    expect(started).toBe(true);
    expect(repository.rows).toEqual([storedReminder({ dueAt: NOW })]);
    expect(repository.followupTransactions).toEqual([FAKE_TRANSACTION]);
    expect(timeline.events).toEqual([
      {
        userId: OLENA_ID,
        applicationId: APPLICATION_ID,
        kind: 'silence_started',
        payload: { silenceDays: 7 },
        occurredAt: NOW,
        tx: FAKE_TRANSACTION,
      },
    ]);
  });
});
