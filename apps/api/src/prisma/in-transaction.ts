import type { Prisma } from '../generated/prisma/client.js';

export type InTransaction = { tx?: Prisma.TransactionClient };
