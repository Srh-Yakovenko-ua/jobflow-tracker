import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../generated/prisma/client.js';

export type QueryLog = {
  readonly prisma: PrismaClient<'query'>;
  statementsDuring(run: () => Promise<unknown>): Promise<number>;
};

export function createQueryLog(databaseUrl: string): QueryLog {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
    log: [{ emit: 'event', level: 'query' }],
  });
  let statements = 0;
  prisma.$on('query', () => {
    statements += 1;
  });
  return {
    prisma,
    statementsDuring: async (run) => {
      const before = statements;
      await run();
      return statements - before;
    },
  };
}
