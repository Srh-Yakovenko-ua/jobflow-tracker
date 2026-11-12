import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { z } from 'zod';

import { withinLimit } from '../../common/probe.js';
import { OUTBOX_LIMITS } from '../../outbox/outbox-relay.service.js';
import { QUEUES } from '../../queues/queues.js';
import { MatchRepository } from './match.repository.js';

export const MATCH_LIMITS = { debounceMs: 5000 } as const;

export const MATCH_JOBS = { trigger: 'match.trigger' } as const;

export const matchTriggerJobSchema = z.object({
  userId: z.uuid(),
  applicationId: z.uuid(),
});

export type MatchTriggerJob = z.infer<typeof matchTriggerJobSchema>;

function triggerJob(data: MatchTriggerJob) {
  const { debounceMs } = MATCH_LIMITS;
  return {
    name: MATCH_JOBS.trigger,
    data,
    opts: {
      delay: debounceMs,
      deduplication: {
        id: `match:${data.applicationId}`,
        ttl: debounceMs,
        extend: true,
        replace: true,
      },
    },
  };
}

@Injectable()
export class MatchTriggerService {
  constructor(
    private readonly repository: MatchRepository,
    @InjectQueue(QUEUES.match.name) private readonly queue: Queue,
  ) {}

  async schedule(userId: string, applicationIds: readonly string[]): Promise<number> {
    if (applicationIds.length === 0) {
      return 0;
    }
    const jobs = applicationIds.map((applicationId) => triggerJob({ userId, applicationId }));
    await withinLimit(this.queue.addBulk(jobs), OUTBOX_LIMITS.publishTimeoutMs);
    return jobs.length;
  }

  async rematchVersion(userId: string, resumeVersionId: string): Promise<number> {
    await this.repository.linkUnlinked(userId, resumeVersionId);
    return this.schedule(userId, await this.repository.findLinkedIds(userId, resumeVersionId));
  }

  async rematchUser(userId: string): Promise<number> {
    const activeVersionId = await this.repository.findActiveVersionId(userId);
    if (activeVersionId !== null) {
      await this.repository.linkUnlinked(userId, activeVersionId);
    }
    return this.schedule(userId, await this.repository.findScorableIds(userId));
  }
}
