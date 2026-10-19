import { randomUUID } from 'node:crypto';

import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { configModule } from '../config/app-config.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type PrismaTestContext = {
  prisma: () => PrismaService;
  trackUser: (userId: string) => void;
};

export function uniqueEmail(): string {
  return `user-${randomUUID()}@example.test`;
}

export function usePrismaTestContext(): PrismaTestContext {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [configModule, PrismaModule] }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds.splice(0) } } });
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  return {
    prisma: () => prisma,
    trackUser: (userId) => {
      createdUserIds.push(userId);
    },
  };
}
