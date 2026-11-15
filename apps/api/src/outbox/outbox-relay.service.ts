import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { milliseconds, subMilliseconds } from 'date-fns';

import { Clock } from '../common/clock.js';
import { withinLimit } from '../common/probe.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { QUEUES } from '../queues/queues.js';
import { OutboxRepository } from './outbox.repository.js';
import { endedAfter, tracedDomainEventJobs } from './outbox-trace.js';

export const OUTBOX_LIMITS = {
  batchSize: 100,
  publishTimeoutMs: 2000,
  transactionTimeoutMs: 5000,
  retentionDays: 7,
} as const;

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
        const { jobs, spans } = tracedDomainEventJobs(rows, this.queue);
        const added = withinLimit(this.queue.addBulk(jobs), OUTBOX_LIMITS.publishTimeoutMs);
        await endedAfter(spans, added);
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
    const retention = milliseconds({ days: OUTBOX_LIMITS.retentionDays });
    const cutoff = subMilliseconds(this.clock.now(), retention);
    const count = await this.repository.deletePublishedBefore(cutoff);
    this.logger.log({ count }, 'published outbox rows deleted');
    return count;
  }
}
