import { setTimeout as delay } from 'node:timers/promises';

import { describe, expect, it } from 'vitest';

import { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { queuedBehindRowLock, useTestDatabase } from './database.js';

const ADVISORY_LOCK = Prisma.sql`SELECT 1 AS held FROM pg_advisory_xact_lock(54)`;

type LockTaker = { name: string; afterMs: number; order: string[] };

function lockTaker(prisma: PrismaService, { name, afterMs, order }: LockTaker) {
  return async () => {
    await delay(afterMs);
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(ADVISORY_LOCK);
      order.push(name);
    });
    return name;
  };
}

describe('queuedBehindRowLock against Postgres', () => {
  const database = useTestDatabase();

  it('gives up with its own message before the transaction and test limits when no call queues', async () => {
    await expect(
      queuedBehindRowLock(database.prisma, {
        lock: Prisma.sql`SELECT 1`,
        calls: [() => Promise.resolve(0)],
      }),
    ).rejects.toThrow('the calls did not queue behind the row lock');
  });

  it('queues the calls behind the lock in their given order, even when the first one is slow to start', async () => {
    const order: string[] = [];

    const answers = await queuedBehindRowLock(database.prisma, {
      lock: ADVISORY_LOCK,
      calls: [
        lockTaker(database.prisma, { name: 'first', afterMs: 300, order }),
        lockTaker(database.prisma, { name: 'second', afterMs: 0, order }),
      ],
    });

    expect([answers, order]).toEqual([
      ['first', 'second'],
      ['first', 'second'],
    ]);
  });
});
