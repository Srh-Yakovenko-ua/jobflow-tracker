import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DEPENDENCY_LIMITS } from '../common/probe.js';
import { configuredDatabaseUrl, prismaAt } from '../test/database.js';
import { outcomeWithin, startTcpProxy, type TcpProxy } from '../test/tcp-proxy.js';
import type { PrismaService } from './prisma.service.js';

const REFUSED_LIMIT_MS = DEPENDENCY_LIMITS.connectTimeoutMs + 500;

const SILENT_LIMIT_MS = DEPENDENCY_LIMITS.queryTimeoutMs + 1000;

describe('PrismaService while Postgres refuses the connection', () => {
  const prisma = prismaAt('postgresql://u:p@127.0.0.1:1/x');

  afterAll(() => prisma.$disconnect());

  it('rejects a query within the connect limit', { timeout: REFUSED_LIMIT_MS + 1000 }, async () => {
    expect(await outcomeWithin(prisma.$queryRaw`SELECT 1`, REFUSED_LIMIT_MS)).toBeInstanceOf(Error);
  });
});

describe('PrismaService while Postgres keeps the connection and never answers', () => {
  let proxy: TcpProxy;
  let prisma: PrismaService;

  beforeAll(async () => {
    proxy = await startTcpProxy(await configuredDatabaseUrl());
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

      expect(await outcomeWithin(prisma.$queryRaw`SELECT 1`, SILENT_LIMIT_MS)).toBeInstanceOf(
        Error,
      );
    },
  );
});
