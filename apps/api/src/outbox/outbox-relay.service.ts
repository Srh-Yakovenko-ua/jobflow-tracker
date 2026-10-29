import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

import { Clock } from '../common/clock.js';
import { withinLimit } from '../common/probe.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { QUEUES } from '../queues/queues.js';
import { OutboxRepository, type UnpublishedOutboxRow } from './outbox.repository.js';

export const OUTBOX_LIMITS = {
  batchSize: 100,
  publishTimeoutMs: 2000,
  transactionTimeoutMs: 5000,
  retentionDays: 7,
} as const;

const DAY_MS = 86_400_000;

function domainEventJob(row: UnpublishedOutboxRow) {
  return { name: row.eventType, data: row.payload, opts: { jobId: row.id } };
}

@Injectable()
export class OutboxRelayService {
  private readonly logger = new Logger(OutboxRelayService.name);

  constructor(
    private readonly repository: OutboxRepository,
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    @InjectQueue(QUEUES.domainEvents.name) private readonly queue: Queue,
  ) {}

  async relay(): Promise<number> {
    const count = await this.prisma.$transaction(
      async (tx) => {
        const rows = await this.repository.claimUnpublished({ limit: OUTBOX_LIMITS.batchSize, tx });
        if (rows.length === 0) {
          return 0;
        }
        const added = this.queue.addBulk(rows.map(domainEventJob));
        await withinLimit(added, OUTBOX_LIMITS.publishTimeoutMs);
        const ids = rows.map(({ id }) => id);
        await this.repository.markPublished(ids, { now: this.clock.now(), tx });
        return rows.length;
      },
      { timeout: OUTBOX_LIMITS.transactionTimeoutMs },
    );
    if (count > 0) {
      this.logger.log({ count }, 'outbox rows published');
    }
    return count;
  }

  async deletePublished(): Promise<number> {
    const cutoff = new Date(this.clock.now().getTime() - OUTBOX_LIMITS.retentionDays * DAY_MS);
    const count = await this.repository.deletePublishedBefore(cutoff);
    this.logger.log({ count }, 'published outbox rows deleted');
    return count;
  }
}
