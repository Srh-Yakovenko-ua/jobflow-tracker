import { AI_JOB_FAILURES, userNow } from '@jobflow/shared';
import { Injectable, Logger } from '@nestjs/common';
import { type Duration, milliseconds, subMilliseconds } from 'date-fns';

import { Clock } from '../common/clock.js';
import { IDEMPOTENCY_LIMITS } from '../common/idempotency/idempotency-request.js';
import { ScheduledJobsRepository } from './scheduled-jobs.repository.js';

export const SCHEDULED_JOB_LIMITS = {
  idempotencyKeyMinutes: IDEMPOTENCY_LIMITS.replayWindowMinutes,
  notificationRetentionDays: 90,
  aiJobStaleMinutes: 60,
} as const;

const MONTHLY_SUMMARY_LOCAL_TIME = { day: 1, hour: 7 } as const;

export type CleanupCounts = {
  idempotencyKeys: number;
  refreshTokens: number;
  notifications: number;
};

export const isMonthlySummaryHour = (local: Date): boolean =>
  local.getDate() === MONTHLY_SUMMARY_LOCAL_TIME.day &&
  local.getHours() === MONTHLY_SUMMARY_LOCAL_TIME.hour;

const before = (now: Date, duration: Duration) => subMilliseconds(now, milliseconds(duration));

@Injectable()
export class ScheduledJobsService {
  private readonly logger = new Logger(ScheduledJobsService.name);

  constructor(
    private readonly repository: ScheduledJobsRepository,
    private readonly clock: Clock,
  ) {}

  async cleanup(): Promise<CleanupCounts> {
    const now = this.clock.now();
    const counts = {
      idempotencyKeys: await this.repository.deleteIdempotencyKeysBefore(
        before(now, { minutes: SCHEDULED_JOB_LIMITS.idempotencyKeyMinutes }),
      ),
      refreshTokens: await this.repository.deleteRefreshTokensExpiredBefore(now),
      notifications: await this.repository.deleteNotificationsBefore(
        before(now, { days: SCHEDULED_JOB_LIMITS.notificationRetentionDays }),
      ),
    };
    this.logger.log(counts, 'expired rows deleted');
    return counts;
  }

  async sweepStaleAiJobs(): Promise<number> {
    const now = this.clock.now();
    const count = await this.repository.failStaleAiJobs({
      createdBefore: before(now, { minutes: SCHEDULED_JOB_LIMITS.aiJobStaleMinutes }),
      now,
      errorType: AI_JOB_FAILURES.abandoned,
    });
    this.logger.log({ count }, 'stale ai jobs failed');
    return count;
  }

  async monthlySummaryUsers(): Promise<string[]> {
    const now = this.clock.now();
    const candidates = await this.repository.monthlySummaryCandidates();
    const userIds = candidates
      .filter((settings) => isMonthlySummaryHour(userNow(settings, now)))
      .map(({ userId }) => userId);
    this.logger.log({ count: userIds.length }, 'monthly summary users picked');
    return userIds;
  }
}
