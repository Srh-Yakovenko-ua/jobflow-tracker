import { Injectable } from '@nestjs/common';

import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { StoredReply } from './idempotency-request.js';

export const IDEMPOTENCY_KEY_SELECT = {
  requestHash: true,
  response: true,
} satisfies Prisma.IdempotencyKeySelect;

export type IdempotencyKeyRow = Prisma.IdempotencyKeyGetPayload<{
  select: typeof IDEMPOTENCY_KEY_SELECT;
}>;

export type ClaimOutcome = { claimed: true } | { claimed: false; holder: IdempotencyKeyRow | null };

export type KeyClaim = { key: string; requestHash: string };

export type KeyClaimInWindow = KeyClaim & { now: Date; windowStart: Date };

export type KeyReply<Reply> = { key: string; reply: Reply };

@Injectable()
export class IdempotencyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async claim(
    userId: string,
    { key, requestHash, now, windowStart }: KeyClaimInWindow,
  ): Promise<ClaimOutcome> {
    await this.prisma.idempotencyKey.deleteMany({
      where: { userId, key, createdAt: { lt: windowStart } },
    });
    const { count } = await this.prisma.idempotencyKey.createMany({
      data: [{ userId, key, requestHash, createdAt: now, updatedAt: now }],
      skipDuplicates: true,
    });
    if (count === 1) return { claimed: true };
    const holder = await this.prisma.idempotencyKey.findUnique({
      where: { userId_key: { userId, key } },
      select: IDEMPOTENCY_KEY_SELECT,
    });
    return { claimed: false, holder };
  }

  async complete(userId: string, { key, reply }: KeyReply<StoredReply>): Promise<void> {
    await this.prisma.idempotencyKey.updateMany({
      where: { userId, key },
      data: { response: reply },
    });
  }

  async release(userId: string, key: string): Promise<void> {
    await this.prisma.idempotencyKey.deleteMany({
      where: { userId, key, response: { equals: Prisma.DbNull } },
    });
  }
}
