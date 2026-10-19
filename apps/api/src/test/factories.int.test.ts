import { describe, expect, it } from 'vitest';

import { resetDatabase, useTestDatabase } from './database.js';
import { createUser } from './factories.js';

describe('the test factories against Postgres', () => {
  const database = useTestDatabase();

  it('creates a user with a uk locale, no password and default settings', async () => {
    const user = await createUser(database.prisma);

    const stored = await database.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { settings: true },
    });
    expect(stored).toMatchObject({ locale: 'uk', passwordHash: null });
    expect(stored.email).toMatch(/^[0-9a-f-]{36}@example\.test$/);
    expect(stored.displayName).toEqual(expect.any(String));
    expect(stored.settings).toMatchObject({ silenceDays: 7, theme: 'system' });
  });

  it('lets overrides win over the defaults', async () => {
    const user = await createUser(database.prisma, {
      email: 'olena@example.test',
      displayName: 'Олена Коваль',
      locale: 'en',
    });

    expect(user).toMatchObject({
      email: 'olena@example.test',
      displayName: 'Олена Коваль',
      locale: 'en',
    });
  });

  it('leaves no users and no settings after a reset', async () => {
    await createUser(database.prisma);
    await createUser(database.prisma);

    await resetDatabase(database.prisma);

    expect([
      await database.prisma.user.count(),
      await database.prisma.userSettings.count(),
    ]).toEqual([0, 0]);
  });
});
