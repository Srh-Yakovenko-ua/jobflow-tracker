import type { ReminderStatus } from '@jobflow/shared';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import type { ByUser } from '../../test/recorded-events.js';
import { APPLICATION_ID, OLENA_ID, SCHEDULED_EVENT_ID } from '../../test/service-fixtures.js';
import { minutesAfter, NOW } from '../../test/time.js';
import {
  type CloseInterviewReminder,
  type InsertInterviewReminder,
  RemindersRepository,
} from './reminders.repository.js';
import { RemindersService } from './reminders.service.js';

type StoredReminder = ByUser<{ scheduledEventId: string; status: ReminderStatus; dueAt: Date }>;

const INTERVIEW = { applicationId: APPLICATION_ID, scheduledEventId: SCHEDULED_EVENT_ID };

class FakeRemindersRepository {
  readonly rows: StoredReminder[] = [];

  closeActiveInterview(
    userId: string,
    { scheduledEventId, status }: CloseInterviewReminder,
  ): Promise<number> {
    const active = this.rows.filter(
      (row) =>
        row.userId === userId &&
        row.scheduledEventId === scheduledEventId &&
        ['pending', 'snoozed'].includes(row.status),
    );
    active.forEach((row) => {
      row.status = status;
    });
    return Promise.resolve(active.length);
  }

  insertInterview(
    userId: string,
    { scheduledEventId, dueAt }: InsertInterviewReminder,
  ): Promise<void> {
    this.rows.push({ userId, scheduledEventId, status: 'pending', dueAt });
    return Promise.resolve();
  }
}

async function serviceWithFake(rows: StoredReminder[] = []) {
  const repository = new FakeRemindersRepository();
  repository.rows.push(...rows);
  const moduleRef = await Test.createTestingModule({
    providers: [RemindersService, RemindersRepository],
  })
    .overrideProvider(RemindersRepository)
    .useValue(repository)
    .compile();
  return { repository, service: moduleRef.get(RemindersService) };
}

const stored = (fields: Omit<StoredReminder, 'scheduledEventId'>): StoredReminder => ({
  scheduledEventId: SCHEDULED_EVENT_ID,
  ...fields,
});

describe('RemindersService.planInterview', () => {
  it('dismisses the active interview reminder and arms one pending row 2 hours ahead', async () => {
    const { repository, service } = await serviceWithFake([
      stored({ userId: OLENA_ID, status: 'snoozed', dueAt: minutesAfter(5) }),
      stored({ userId: OLENA_ID, status: 'done', dueAt: minutesAfter(-60) }),
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
      stored({ userId: OLENA_ID, status: 'pending', dueAt: minutesAfter(30) }),
    ]);

    await service.closeInterview(OLENA_ID, { ...INTERVIEW, status: 'done' });

    expect(repository.rows.map(({ status }) => status)).toEqual(['done']);
  });
});
