import { setTimeout as delay } from 'node:timers/promises';

import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DEPENDENCY_LIMITS } from '../common/probe.js';
import { type AppConfig, configModule } from '../config/app-config.js';
import { startTcpProxy, type TcpProxy } from '../test/tcp-proxy.js';
import { PrismaService } from './prisma.service.js';

const REFUSED_LIMIT_MS = DEPENDENCY_LIMITS.connectTimeoutMs + 500;

const SILENT_LIMIT_MS = DEPENDENCY_LIMITS.queryTimeoutMs + 1000;

const prismaAt = (databaseUrl: string) =>
  new PrismaService(new ConfigService({ DATABASE_URL: databaseUrl }));

function settledWithin(query: Promise<unknown>, limitMs: number): Promise<string> {
  const settled = query.then(
    () => 'answered',
    () => 'rejected',
  );
  return Promise.race([settled, delay(limitMs, 'still pending', { ref: false })]);
}

describe('PrismaService while Postgres refuses the connection', () => {
  const prisma = prismaAt('postgresql://u:p@127.0.0.1:1/x');

  afterAll(() => prisma.$disconnect());

  it('rejects a query within the connect limit', { timeout: REFUSED_LIMIT_MS + 1000 }, async () => {
    expect(await settledWithin(prisma.$queryRaw`SELECT 1`, REFUSED_LIMIT_MS)).toBe('rejected');
  });
});

describe('PrismaService while Postgres keeps the connection and never answers', () => {
  let proxy: TcpProxy;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [configModule] }).compile();
    const databaseUrl = moduleRef
      .get<AppConfig>(ConfigService)
      .get('DATABASE_URL', { infer: true });
    proxy = await startTcpProxy(databaseUrl);
    prisma = prismaAt(proxy.url);
  });

  afterAll(async () => {
    await proxy.close();
    await prisma.$disconnect();
  });

  it(
    'rejects the next query within the query limit once the open connection stops answering',
    { timeout: SILENT_LIMIT_MS + 1000 },
    async () => {
      expect(await prisma.$queryRaw`SELECT 1 AS answer`).toEqual([{ answer: 1 }]);
      proxy.silence();

      expect(await settledWithin(prisma.$queryRaw`SELECT 1`, SILENT_LIMIT_MS)).toBe('rejected');
    },
  );
});
