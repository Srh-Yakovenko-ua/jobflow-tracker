import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, expect } from 'vitest';

import { type AppConfig, configModule } from '../config/app-config.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PrismaService } from '../prisma/prisma.service.js';

const TEST_DATABASE_NAME = /^jobflow_(test|[a-z]+_\d+)$/;

export type TestDatabase = { readonly prisma: PrismaService };

export type RowLockQueue<T> = {
  readonly lock: Prisma.Sql;
  readonly calls: readonly (() => Promise<T>)[];
};

export function prismaAt(databaseUrl: string): PrismaService {
  return new PrismaService(new ConfigService({ DATABASE_URL: databaseUrl }));
}

export async function configuredDatabaseUrl(): Promise<string> {
  const moduleRef = await Test.createTestingModule({ imports: [configModule] }).compile();
  return moduleRef.get<AppConfig>(ConfigService).get('DATABASE_URL', { infer: true });
}

export function assertTestDatabase(name: string): void {
  if (!TEST_DATABASE_NAME.test(name)) {
    throw new Error(`Refusing to reset ${name}: only jobflow_test or a card database is reset`);
  }
}

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  const [row] = await prisma.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
  assertTestDatabase(row?.name ?? '');
  await prisma.$executeRaw`TRUNCATE TABLE users, outbox CASCADE`;
}

async function countLockWaiters(prisma: PrismaService): Promise<number | undefined> {
  const [row] = await prisma.$queryRaw<{ waiting: number }[]>`
    SELECT count(*)::int AS waiting FROM pg_stat_activity
    WHERE datname = current_database() AND wait_event_type = 'Lock'`;
  return row?.waiting;
}

export async function queuedBehindRowLock<T>(
  prisma: PrismaService,
  { lock, calls }: RowLockQueue<T>,
): Promise<Awaited<T>[]> {
  let queued: Promise<Awaited<T>[]> = Promise.resolve([]);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(lock);
      queued = Promise.all(calls.map((call) => call()));
      await expect.poll(() => countLockWaiters(prisma), { timeout: 5000 }).toBe(calls.length);
    });
  } catch (error) {
    await queued.catch(() => undefined);
    throw error;
  }
  return queued;
}

export function useTestDatabase(): TestDatabase {
  let moduleRef: TestingModule | undefined;
  const database = {
    get prisma(): PrismaService {
      if (!moduleRef) throw new Error('useTestDatabase is read before its beforeAll ran');
      return moduleRef.get(PrismaService);
    },
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [configModule, PrismaModule] }).compile();
    await moduleRef.init();
  });
  beforeEach(() => resetDatabase(database.prisma));
  afterAll(() => moduleRef?.close());

  return database;
}
