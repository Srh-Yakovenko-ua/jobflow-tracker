import type { NotificationType } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AI_JOB_ID } from '../../test/ai.js';
import { FAKE_TRANSACTION, FakePrisma, fakeTransactionModule } from '../../test/fake-prisma.js';
import type { ByUser } from '../../test/recorded-events.js';
import { APPLICATION_ID, BOHDAN_ID, OLENA_ID } from '../../test/service-fixtures.js';
import { minutesAfter, NOW } from '../../test/time.js';
import {
  type ExistingNotification,
  type InsertNotification,
  type MarkRead,
  type NotificationPage,
  type NotificationRow,
  NotificationsRepository,
  type Transaction,
} from './notifications.repository.js';
import { NotificationsService } from './notifications.service.js';

type StoredNotification = ByUser<NotificationRow>;

type Written = ByUser<InsertNotification> | ByUser<Transaction>;

const idOf = (index: number) => `0199f0a0-0000-7000-8000-${String(index).padStart(12, '0')}`;

const SILENCE = { items: [{ applicationId: APPLICATION_ID, company: 'Ромашка', days: 7 }] };

const AI_DONE = { aiJobId: AI_JOB_ID, kind: 'vacancy_parse' as const };

const OTHER_AI_JOB_ID = idOf(999);

const byIdDesc = (left: StoredNotification, right: StoredNotification) =>
  right.id.localeCompare(left.id);

function storedRow(index: number, fields: Partial<StoredNotification> = {}): StoredNotification {
  return {
    userId: OLENA_ID,
    id: idOf(index),
    type: 'silence',
    payload: SILENCE,
    readAt: null,
    createdAt: minutesAfter(index),
    ...fields,
  };
}

class FakeNotificationsRepository {
  readonly rows: StoredNotification[] = [];

  readonly writes: Written[] = [];

  insert(userId: string, notification: InsertNotification): Promise<string> {
    this.writes.push({ userId, ...notification });
    const id = idOf(this.rows.length + 100);
    const { type } = notification;
    const payload = z.json().parse(notification.payload);
    this.rows.push(storedRow(this.rows.length + 100, { userId, id, type, payload }));
    return Promise.resolve(id);
  }

  lockUser(userId: string, { tx }: Transaction): Promise<void> {
    this.writes.push({ userId, tx });
    return Promise.resolve();
  }

  exists(userId: string, { type, aiJobId }: ExistingNotification): Promise<boolean> {
    const jobOf = (payload: Prisma.JsonValue) =>
      typeof payload === 'object' && payload !== null && 'aiJobId' in payload
        ? payload.aiJobId
        : undefined;
    const found = this.ownedBy(userId).some(
      (row) => row.type === type && (aiJobId === undefined || jobOf(row.payload) === aiJobId),
    );
    return Promise.resolve(found);
  }

  list(userId: string, { unread, cursor, limit }: NotificationPage): Promise<NotificationRow[]> {
    const rows = this.ownedBy(userId)
      .filter((row) => unread === undefined || (row.readAt === null) === unread)
      .filter((row) => cursor === undefined || row.id < cursor)
      .sort(byIdDesc)
      .slice(0, limit + 1);
    return Promise.resolve(rows);
  }

  markRead(userId: string, { ids, now }: MarkRead): Promise<number> {
    const marked = this.ownedBy(userId).filter(
      (row) => row.readAt === null && (ids === undefined || ids.includes(row.id)),
    );
    marked.forEach((row) => {
      row.readAt = now;
    });
    return Promise.resolve(marked.length);
  }

  countUnread(userId: string): Promise<number> {
    return Promise.resolve(this.ownedBy(userId).filter(({ readAt }) => readAt === null).length);
  }

  private ownedBy(userId: string): StoredNotification[] {
    return this.rows.filter((row) => row.userId === userId);
  }
}

class CountingPrisma extends FakePrisma {
  opened = 0;

  override $transaction<T>(work: (client: typeof FAKE_TRANSACTION) => Promise<T>): Promise<T> {
    this.opened += 1;
    return super.$transaction(work);
  }
}

async function serviceWith(rows: StoredNotification[] = []) {
  const repository = new FakeNotificationsRepository();
  const prisma = new CountingPrisma();
  repository.rows.push(...rows);
  const moduleRef = await fakeTransactionModule({
    providers: [NotificationsService, { provide: NotificationsRepository, useValue: repository }],
    now: NOW,
  })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .compile();
  const within = (work: (client: Prisma.TransactionClient) => Promise<void>) =>
    moduleRef.get(PrismaService).$transaction(work);
  return { repository, prisma, within, service: moduleRef.get(NotificationsService) };
}

const readStates = (rows: StoredNotification[]) => rows.map(({ readAt }) => readAt);

const typesOf = (rows: StoredNotification[]): NotificationType[] => rows.map(({ type }) => type);

describe('NotificationsService.list', () => {
  it('answers the newest notifications first with ISO dates and the id of the last one as the cursor', async () => {
    const { service } = await serviceWith([
      storedRow(1),
      storedRow(2, { readAt: minutesAfter(5) }),
      storedRow(3),
    ]);

    await expect(service.list(OLENA_ID, { limit: 2 })).resolves.toEqual({
      items: [
        {
          id: idOf(3),
          type: 'silence',
          payload: SILENCE,
          readAt: null,
          createdAt: '2026-10-22T09:03:00.000Z',
        },
        expect.objectContaining({ id: idOf(2), readAt: '2026-10-22T09:05:00.000Z' }),
      ],
      nextCursor: idOf(2),
    });
  });

  it('answers a last page that is exactly full with a null cursor', async () => {
    const { service } = await serviceWith([storedRow(1), storedRow(2), storedRow(3)]);

    const page = await service.list(OLENA_ID, { limit: 2, cursor: idOf(3) });

    expect(page.items.map(({ id }) => id)).toEqual([idOf(2), idOf(1)]);
    expect(page.nextCursor).toBeNull();
  });

  it("keeps the unread notifications of the user and none of another user's", async () => {
    const { service } = await serviceWith([
      storedRow(1),
      storedRow(2, { readAt: NOW }),
      storedRow(3, { userId: BOHDAN_ID }),
    ]);

    const page = await service.list(OLENA_ID, { limit: 50, unread: true });

    expect(page.items.map(({ id }) => id)).toEqual([idOf(1)]);
  });
});

describe('NotificationsService.markRead', () => {
  it("marks the given ids of the user read at now, leaves another user's id and answers the unread count", async () => {
    const { repository, service } = await serviceWith([
      storedRow(1),
      storedRow(2),
      storedRow(3, { userId: BOHDAN_ID }),
    ]);

    await expect(service.markRead(OLENA_ID, { ids: [idOf(1), idOf(3)] })).resolves.toEqual({
      unread: 1,
    });

    expect(readStates(repository.rows)).toEqual([NOW, null, null]);
  });

  it("marks every unread notification of the user with all and leaves another user's", async () => {
    const { repository, service } = await serviceWith([
      storedRow(1),
      storedRow(2, { readAt: minutesAfter(1) }),
      storedRow(3, { userId: BOHDAN_ID }),
    ]);

    await expect(service.markRead(OLENA_ID, { all: true })).resolves.toEqual({ unread: 0 });

    expect(readStates(repository.rows)).toEqual([NOW, minutesAfter(1), null]);
  });
});

describe('NotificationsService.record', () => {
  it("writes the notification in the caller's transaction and opens none of its own", async () => {
    const { repository, prisma, within, service } = await serviceWith();

    await within((tx) => service.record(OLENA_ID, { type: 'silence', payload: SILENCE, tx }));

    expect(repository.writes).toEqual([
      { userId: OLENA_ID, type: 'silence', payload: SILENCE, tx: FAKE_TRANSACTION },
    ]);
    expect(prisma.opened).toBe(1);
  });

  it('writes the notification in a transaction of its own without one', async () => {
    const { repository, prisma, service } = await serviceWith();

    await service.record(OLENA_ID, { type: 'silence', payload: SILENCE });

    expect(repository.writes).toEqual([
      { userId: OLENA_ID, type: 'silence', payload: SILENCE, tx: FAKE_TRANSACTION },
    ]);
    expect(prisma.opened).toBe(1);
  });
});

describe('NotificationsService.recordOnce', () => {
  it('locks the user before it writes the first ai_done of a job, in one transaction', async () => {
    const { repository, service } = await serviceWith();

    await service.recordOnce(OLENA_ID, { type: 'ai_done', payload: AI_DONE });

    expect(repository.writes).toEqual([
      { userId: OLENA_ID, tx: FAKE_TRANSACTION },
      { userId: OLENA_ID, type: 'ai_done', payload: AI_DONE, tx: FAKE_TRANSACTION },
    ]);
  });

  it('writes ai_done once per job and once more for another job', async () => {
    const { repository, service } = await serviceWith();
    const other = { ...AI_DONE, aiJobId: OTHER_AI_JOB_ID };

    await service.recordOnce(OLENA_ID, { type: 'ai_done', payload: AI_DONE });
    await service.recordOnce(OLENA_ID, { type: 'ai_done', payload: AI_DONE });
    await service.recordOnce(OLENA_ID, { type: 'ai_done', payload: other });

    expect(typesOf(repository.rows)).toEqual(['ai_done', 'ai_done']);
  });

  it('writes insight_unlocked once for the user and once for another user', async () => {
    const { repository, service } = await serviceWith();
    const unlocked = { type: 'insight_unlocked', payload: { applications: 10 } } as const;

    await service.recordOnce(OLENA_ID, unlocked);
    await service.recordOnce(OLENA_ID, { ...unlocked, payload: { applications: 11 } });
    await service.recordOnce(BOHDAN_ID, unlocked);

    expect(repository.rows.map(({ userId }) => userId)).toEqual([OLENA_ID, BOHDAN_ID]);
  });
});
