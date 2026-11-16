import { AI_JOB_FAILURES } from '@jobflow/shared';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';

import { before, Clock } from '../common/clock.js';
import { errorMessageOf } from '../common/error-message.js';
import { retryAiCompletion } from '../modules/ai/index.js';
import { QUEUES } from '../queues/queues.js';
import { ScheduledJobsRepository } from './scheduled-jobs.repository.js';

export const AI_JOBS_SWEEP_LIMITS = {
  staleMinutes: 60,
  failureGraceMinutes: 5,
  failureWindowDays: 1,
  failureBatch: 20,
} as const;

@Injectable()
export class AiJobsSweepService {
  private readonly logger = new Logger(AiJobsSweepService.name);

  constructor(
    private readonly repository: ScheduledJobsRepository,
    private readonly clock: Clock,
    @InjectQueue(QUEUES.ai.name) private readonly aiQueue: Queue,
  ) {}

  async sweepStaleAiJobs(): Promise<number> {
    const now = this.clock.now();
    const count = await this.repository.failStaleAiJobs({
      createdBefore: before(now, { minutes: AI_JOBS_SWEEP_LIMITS.staleMinutes }),
      now,
      errorType: AI_JOB_FAILURES.abandoned,
    });
    this.logger.log({ count }, 'stale ai jobs failed');
    return count;
  }

  async redeliverUnsettledAiFailures(): Promise<number> {
    const now = this.clock.now();
    const aiJobIds = await this.repository.unsettledAiFailureIds({
      finishedAfter: before(now, { days: AI_JOBS_SWEEP_LIMITS.failureWindowDays }),
      finishedBefore: before(now, { minutes: AI_JOBS_SWEEP_LIMITS.failureGraceMinutes }),
      take: AI_JOBS_SWEEP_LIMITS.failureBatch,
    });
    let count = 0;
    for (const aiJobId of aiJobIds) {
      count += Number(await this.redelivered(aiJobId));
    }
    this.logger.log({ count }, 'ai failures redelivered');
    return count;
  }

  private async redelivered(aiJobId: string): Promise<boolean> {
    try {
      return await retryAiCompletion(this.aiQueue, aiJobId);
    } catch (error) {
      this.logger.warn({ aiJobId, err: errorMessageOf(error) }, 'ai failure not redelivered');
      return false;
    }
  }
}
