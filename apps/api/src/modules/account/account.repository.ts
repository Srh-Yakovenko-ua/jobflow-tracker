import { Injectable } from '@nestjs/common';

import type { InTransaction } from '../../prisma/in-transaction.js';
import { lockUser } from '../../prisma/lock-user.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  ACCOUNT_EVENTS,
  type ExportRequested,
  exportRequestedEvent,
  exportRequestedPayloadSchema,
} from './account.events.js';

export type InAccountTransaction = Required<InTransaction>;

export type RecordExportRequested = InAccountTransaction & { requested: ExportRequested };

@Injectable()
export class AccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async latestExportId(userId: string): Promise<string | null> {
    const latest = await this.prisma.outboxEvent.findFirst({
      where: { aggregateId: userId, eventType: ACCOUNT_EVENTS.exportRequested },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { payload: true },
    });
    return latest === null ? null : exportRequestedPayloadSchema.parse(latest.payload).exportId;
  }

  async lockUser(userId: string, { tx }: InAccountTransaction): Promise<void> {
    await lockUser(tx, userId);
  }

  async exists(userId: string, { tx }: InAccountTransaction): Promise<boolean> {
    return (await tx.user.count({ where: { id: userId } })) > 0;
  }

  async deleteOutboxOf(userId: string, { tx }: InAccountTransaction): Promise<void> {
    await tx.$executeRaw`DELETE FROM outbox WHERE payload->>'userId' = ${userId} OR aggregate_id = ${userId}::uuid`;
  }

  async deleteUser(userId: string, { tx }: InAccountTransaction): Promise<void> {
    await tx.user.deleteMany({ where: { id: userId } });
  }

  async recordExportRequested(
    userId: string,
    { requested, tx }: RecordExportRequested,
  ): Promise<void> {
    await tx.outboxEvent.create({
      data: exportRequestedEvent(userId, requested),
      select: { id: true },
    });
  }
}
