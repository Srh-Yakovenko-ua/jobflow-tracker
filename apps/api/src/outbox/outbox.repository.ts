import { Injectable } from '@nestjs/common';

import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type UnpublishedOutboxRow = { id: string; eventType: string; payload: Prisma.JsonValue };

export type ClaimUnpublished = { limit: number; tx: Prisma.TransactionClient };

export type MarkPublished = { now: Date; tx: Prisma.TransactionClient };

@Injectable()
export class OutboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  claimUnpublished({ limit, tx }: ClaimUnpublished): Promise<UnpublishedOutboxRow[]> {
    return tx.$queryRaw<UnpublishedOutboxRow[]>`
      SELECT id, event_type AS "eventType", payload FROM outbox
      WHERE published_at IS NULL
      ORDER BY created_at, id
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED`;
  }

  async markPublished(ids: string[], { now, tx }: MarkPublished): Promise<void> {
    await tx.outboxEvent.updateMany({ where: { id: { in: ids } }, data: { publishedAt: now } });
  }

  async deletePublishedBefore(cutoff: Date): Promise<number> {
    const { count } = await this.prisma.outboxEvent.deleteMany({
      where: { publishedAt: { lt: cutoff } },
    });
    return count;
  }
}
