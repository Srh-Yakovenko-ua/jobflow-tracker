import { userNow } from '@jobflow/shared';
import { Injectable, Logger } from '@nestjs/common';

import { before, Clock } from '../common/clock.js';
import { IDEMPOTENCY_LIMITS } from '../common/idempotency/idempotency-request.js';
import {
  InterviewAlertsService,
  type SilenceScanCounts,
  SilenceScanService,
} from '../modules/reminders/index.js';
import { type LocalTimeCandidate, ScheduledJobsRepository } from './scheduled-jobs.repository.js';

export const SCHEDULED_JOB_LIMITS = {
  idempotencyKeyMinutes: IDEMPOTENCY_LIMITS.replayWindowMinutes,
  notificationRetentionDays: 90,
} as const;

const MONTHLY_SUMMARY_LOCAL_TIME = { day: 1, hour: 7 } as const;

const WEEK_CLOSE_LOCAL_TIME = { weekday: 1, hour: 8 } as const;

export type CleanupCounts = {
  idempotencyKeys: number;
  refreshTokens: number;
  notifications: number;
};

export type SilenceScanTotals = SilenceScanCounts & { users: number };

export type InterviewReminderTotals = { users: number; alerted: number };

export const isMonthlySummaryHour = (local: Date): boolean =>
  local.getDate() === MONTHLY_SUMMARY_LOCAL_TIME.day &&
  local.getHours() === MONTHLY_SUMMARY_LOCAL_TIME.hour;

export const isWeekCloseHour = (local: Date): boolean =>
  local.getDay() === WEEK_CLOSE_LOCAL_TIME.weekday &&
  local.getHours() === WEEK_CLOSE_LOCAL_TIME.hour;

type LocalTimePick = {
  candidates: LocalTimeCandidate[];
  isLocalHour: (local: Date) => boolean;
  label: string;
};

@Injectable()
export class ScheduledJobsService {
  private readonly logger = new Logger(ScheduledJobsService.name);

  constructor(
    private readonly repository: ScheduledJobsRepository,
    private readonly clock: Clock,
    private readonly silence: SilenceScanService,
    private readonly interviewAlerts: InterviewAlertsService,
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

  async monthlySummaryUsers(): Promise<string[]> {
    return this.usersAtLocalHour({
      candidates: await this.repository.monthlySummaryCandidates(),
      isLocalHour: isMonthlySummaryHour,
      label: 'monthly summary users picked',
    });
  }

  async weekCloseUsers(): Promise<string[]> {
    return this.usersAtLocalHour({
      candidates: await this.repository.weekCloseCandidates(),
      isLocalHour: isWeekCloseHour,
      label: 'week close users picked',
    });
  }

  private usersAtLocalHour({ candidates, isLocalHour, label }: LocalTimePick): string[] {
    const now = this.clock.now();
    const userIds = candidates
      .filter((settings) => isLocalHour(userNow(settings, now)))
      .map(({ userId }) => userId);
    this.logger.log({ count: userIds.length }, label);
    return userIds;
  }

  async silenceScan(): Promise<SilenceScanTotals> {
    const now = this.clock.now();
    const userIds = await this.repository.silenceScanUserIds();
    const totals = { users: userIds.length, started: 0, alreadyStarted: 0 };
    for (const userId of userIds) {
      const { started, alreadyStarted } = await this.silence.startSilence(userId, now);
      totals.started += started;
      totals.alreadyStarted += alreadyStarted;
    }
    this.logger.log(totals, 'silence scan done');
    return totals;
  }

  async interviewReminders(): Promise<InterviewReminderTotals> {
    const now = this.clock.now();
    const userIds = await this.repository.dueInterviewUserIds(now);
    const totals = { users: userIds.length, alerted: 0 };
    for (const userId of userIds) {
      totals.alerted += await this.interviewAlerts.fireDue(userId, now);
    }
    this.logger.log(totals, 'interview reminders fired');
    return totals;
  }
}
