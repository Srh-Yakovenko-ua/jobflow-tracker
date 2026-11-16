import { describe, expect, it } from 'vitest';

import { Prisma } from '../generated/prisma/client.js';
import { queuedBehindRowLock, useTestDatabase } from './database.js';

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
});
