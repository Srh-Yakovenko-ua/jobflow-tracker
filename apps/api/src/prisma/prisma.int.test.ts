import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { useTestDatabase } from '../test/database.js';
import { createUser } from '../test/factories.js';

describe('the users, auth and settings tables in Postgres', () => {
  const database = useTestDatabase();

  function ownedRowCounts(userId: string): Promise<number[]> {
    const where = { userId };
    const { prisma } = database;
    return Promise.all([
      prisma.userSettings.count({ where }),
      prisma.refreshToken.count({ where }),
      prisma.oAuthAccount.count({ where }),
      prisma.captureToken.count({ where }),
    ]);
  }

  it('a user created with nested settings gets every default', async () => {
    const { id } = await createUser(database.prisma);

    const user = await database.prisma.user.findUniqueOrThrow({
      where: { id },
      include: { settings: true },
    });

    expect(user.locale).toBe('uk');
    expect(user.settings).toMatchObject({
      silenceDays: 7,
      autoGhostDays: 30,
      askRejectionReason: true,
      monthlySummaryEnabled: true,
      theme: 'system',
      timezone: 'Europe/Kyiv',
      quietHoursStart: new Date('1970-01-01T22:00:00.000Z'),
      quietHoursEnd: new Date('1970-01-01T08:00:00.000Z'),
      notifyInApp: true,
      notifyPush: false,
      notifyEmail: true,
      analyticsOptOut: false,
    });
  });

  it('deleting a user removes their settings, refresh tokens, oauth accounts and capture tokens', async () => {
    const user = await createUser(database.prisma, {
      refreshTokens: {
        create: {
          tokenHash: randomUUID(),
          familyId: randomUUID(),
          expiresAt: new Date('2026-11-19T00:00:00.000Z'),
        },
      },
      oauthAccounts: { create: { provider: 'github', providerUserId: randomUUID() } },
      captureTokens: { create: { tokenHash: randomUUID() } },
    });
    const before = await ownedRowCounts(user.id);

    await database.prisma.user.delete({ where: { id: user.id } });

    expect(before).toEqual([1, 1, 1, 1]);
    expect(await ownedRowCounts(user.id)).toEqual([0, 0, 0, 0]);
  });

  it('an email that differs only in case is refused as a duplicate', async () => {
    const email = `Case-${randomUUID()}@Example.Test`;
    await createUser(database.prisma, { email });

    await expect(
      database.prisma.user.create({ data: { email: email.toLowerCase() } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});
