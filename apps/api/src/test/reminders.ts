import { OPEN_STAGES, type ReminderStatus, type Stage } from '@jobflow/shared';

import type {
  CloseFollowups,
  CloseInterviewReminder,
  CloseReminder,
  InsertFollowup,
  InsertInterviewReminder,
  NewNotification,
  ReminderRow,
} from '../modules/reminders/index.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { signedInWithSearch } from './applications.js';
import { createApplicationRows } from './factories.js';
import type { ByUser } from './recorded-events.js';
import { APPLICATION_ID, OLENA_ID, REMINDER_ID } from './service-fixtures.js';
import { NOW, type SettableClock } from './time.js';

export type StoredReminder = ByUser<ReminderRow>;

export type StoredNotification = ByUser<NewNotification>;

export type StageApplication = { stage: Stage; lastEventAt: Date };

export type StageApplicationOwner = { userId: string; accessToken: string; applicationId: string };

export type Ticks = { instants: Date[]; run: () => Promise<unknown> };

const ACTIVE: readonly ReminderStatus[] = ['pending', 'snoozed'];

const OPEN: readonly Stage[] = OPEN_STAGES;

export function storedReminder(fields: Partial<StoredReminder> = {}): StoredReminder {
  return {
    userId: OLENA_ID,
    id: REMINDER_ID,
    applicationId: APPLICATION_ID,
    type: 'followup',
    status: 'pending',
    scheduledEventId: null,
    dueAt: NOW,
    snoozedUntil: null,
    application: { company: 'Ромашка', currentStage: 'applied' },
    ...fields,
  };
}

const byDueAtThenId = (left: StoredReminder, right: StoredReminder) =>
  left.dueAt.getTime() - right.dueAt.getTime() || left.id.localeCompare(right.id);

const withoutOwner = (stored: StoredReminder): ReminderRow => {
  const { id, applicationId, type, status, scheduledEventId, dueAt, snoozedUntil } = stored;
  const { application } = stored;
  return { id, applicationId, type, status, scheduledEventId, dueAt, snoozedUntil, application };
};

export class FakeRemindersRepository {
  readonly rows: StoredReminder[] = [];

  readonly notifications: StoredNotification[] = [];

  closeActiveInterview(
    userId: string,
    { scheduledEventId, status }: CloseInterviewReminder,
  ): Promise<number> {
    return this.closeWhere(
      (row) => row.userId === userId && row.scheduledEventId === scheduledEventId,
      status,
    );
  }

  closeActiveFollowups(userId: string, { applicationId, status }: CloseFollowups) {
    return this.closeWhere(
      (row) =>
        row.userId === userId && row.applicationId === applicationId && row.type === 'followup',
      status,
    );
  }

  insertInterview(
    userId: string,
    { applicationId, scheduledEventId, dueAt }: InsertInterviewReminder,
  ) {
    const interview = { applicationId, scheduledEventId, dueAt, type: 'interview_soon' as const };
    this.rows.push(storedReminder({ userId, ...interview }));
    return Promise.resolve();
  }

  insertFollowup(userId: string, { applicationId, dueAt }: InsertFollowup) {
    this.rows.push(storedReminder({ userId, applicationId, dueAt }));
    return Promise.resolve();
  }

  insertNotification(userId: string, notification: NewNotification): Promise<void> {
    this.notifications.push({ userId, ...notification });
    return Promise.resolve();
  }

  findActive(userId: string): Promise<ReminderRow[]> {
    const active = this.rows.filter(
      (row) =>
        row.userId === userId &&
        ACTIVE.includes(row.status) &&
        OPEN.includes(row.application.currentStage),
    );
    return Promise.resolve(active.sort(byDueAtThenId).map(withoutOwner));
  }

  closeActive(userId: string, { id, ...change }: CloseReminder) {
    const row = this.rows.find(
      (candidate) =>
        candidate.userId === userId && candidate.id === id && ACTIVE.includes(candidate.status),
    );
    if (row !== undefined) {
      Object.assign(row, change);
    }
    return Promise.resolve(row && withoutOwner(row));
  }

  findOwnedStatus(userId: string, id: string) {
    const row = this.rows.find((candidate) => candidate.userId === userId && candidate.id === id);
    return Promise.resolve(row ? { status: row.status } : null);
  }

  private closeWhere(matches: (row: StoredReminder) => boolean, status: ReminderStatus) {
    const active = this.rows.filter((row) => matches(row) && ACTIVE.includes(row.status));
    active.forEach((row) => {
      row.status = status;
    });
    return Promise.resolve(active.length);
  }
}

export function remindersOf(prisma: PrismaService, applicationId: string) {
  return prisma.reminder.findMany({
    where: { applicationId },
    orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
    select: { type: true, status: true, dueAt: true },
  });
}

export async function ownedStageApplication(
  prisma: PrismaService,
  { stage, lastEventAt }: StageApplication,
): Promise<StageApplicationOwner> {
  const { userId, searchId, accessToken } = await signedInWithSearch(prisma);
  const [applicationId = ''] = await createApplicationRows(prisma, {
    userId,
    searchId,
    rows: [{ company: 'Acme', currentStage: stage, lastEventAt }],
  });
  return { userId, accessToken, applicationId };
}

export async function runAt(clock: SettableClock, { instants, run }: Ticks): Promise<void> {
  for (const instant of instants) {
    clock.at(instant);
    await run();
  }
}

export function notificationsOf(prisma: PrismaService, userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: [{ id: 'asc' }],
    select: { type: true, payload: true },
  });
}
