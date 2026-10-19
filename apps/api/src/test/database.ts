import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach } from 'vitest';

import { configModule } from '../config/app-config.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PrismaService } from '../prisma/prisma.service.js';

const TEST_DATABASE_NAME = /^jobflow_(test|[a-z]+_\d+)$/;

export type TestDatabase = { readonly prisma: PrismaService };

export function assertTestDatabase(name: string): void {
  if (!TEST_DATABASE_NAME.test(name)) {
    throw new Error(`Refusing to reset ${name}: only jobflow_test or a card database is reset`);
  }
}

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  const [row] = await prisma.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
  assertTestDatabase(row?.name ?? '');
  await prisma.$executeRaw`TRUNCATE TABLE users CASCADE`;
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
