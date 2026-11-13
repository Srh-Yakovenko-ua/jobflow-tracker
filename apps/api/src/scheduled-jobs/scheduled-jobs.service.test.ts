import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { Clock } from '../common/clock.js';
import { memoryLog } from '../test/memory-log.js';
import { compileProcessorModule } from '../test/processor.js';
import { NOW, settableClock } from '../test/time.js';
import type { MonthlySummaryCandidate, StaleAiJobs } from './scheduled-jobs.repository.js';
import { ScheduledJobsRepository } from './scheduled-jobs.repository.js';
import { ScheduledJobsService } from './scheduled-jobs.service.js';

const log = memoryLog();

type RepositoryCall = { method: string; at: Date } | { method: string; sweep: StaleAiJobs };

class FakeScheduledJobsRepository {
  readonly calls: RepositoryCall[] = [];

  candidates: MonthlySummaryCandidate[] = [];

  deleteIdempotencyKeysBefore(at: Date): Promise<number> {
    return this.counted({ method: 'deleteIdempotencyKeysBefore', at }, 2);
  }

  deleteRefreshTokensExpiredBefore(at: Date): Promise<number> {
    return this.counted({ method: 'deleteRefreshTokensExpiredBefore', at }, 3);
  }

  deleteNotificationsBefore(at: Date): Promise<number> {
    return this.counted({ method: 'deleteNotificationsBefore', at }, 4);
  }

  failStaleAiJobs(sweep: StaleAiJobs): Promise<number> {
    return this.counted({ method: 'failStaleAiJobs', sweep }, 5);
  }

  monthlySummaryCandidates(): Promise<MonthlySummaryCandidate[]> {
    return Promise.resolve(this.candidates);
  }

  private counted(call: RepositoryCall, count: number): Promise<number> {
    this.calls.push(call);
    return Promise.resolve(count);
  }
}

const KYIV_USER = { userId: 'user-kyiv', timezone: 'Europe/Kyiv' };

const UTC_USER = { userId: 'user-utc', timezone: 'UTC' };

const KOLKATA_USER = { userId: 'user-kolkata', timezone: 'Asia/Kolkata' };

describe('ScheduledJobsService', () => {
  const repository = new FakeScheduledJobsRepository();
  const clock = settableClock(NOW);
  let service: ScheduledJobsService;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const moduleRef = await compileProcessorModule(log.sink, [
      ScheduledJobsService,
      { provide: ScheduledJobsRepository, useValue: repository },
      { provide: Clock, useValue: clock },
    ]);
    service = moduleRef.get(ScheduledJobsService);
    close = () => moduleRef.close();
  });

  beforeEach(() => {
    log.lines.length = 0;
    repository.calls.length = 0;
    repository.candidates = [KYIV_USER, UTC_USER, KOLKATA_USER];
    clock.at(NOW);
  });

  afterAll(async () => {
    await close();
  });

  it('deletes idempotency keys older than 24 hours, expired refresh tokens and notifications older than 90 days', async () => {
    await expect(service.cleanup()).resolves.toEqual({
      idempotencyKeys: 2,
      refreshTokens: 3,
      notifications: 4,
    });

    expect(repository.calls).toEqual([
      { method: 'deleteIdempotencyKeysBefore', at: new Date('2026-10-21T09:00:00.000Z') },
      { method: 'deleteRefreshTokensExpiredBefore', at: new Date('2026-10-22T09:00:00.000Z') },
      { method: 'deleteNotificationsBefore', at: new Date('2026-07-24T09:00:00.000Z') },
    ]);
    expect(log.parsed()).toEqual([
      expect.objectContaining({ idempotencyKeys: 2, refreshTokens: 3, notifications: 4 }),
    ]);
  });

  it('fails ai jobs created more than 60 minutes ago as abandoned, finished now', async () => {
    await expect(service.sweepStaleAiJobs()).resolves.toBe(5);

    expect(repository.calls).toEqual([
      {
        method: 'failStaleAiJobs',
        sweep: {
          createdBefore: new Date('2026-10-22T08:00:00.000Z'),
          now: new Date('2026-10-22T09:00:00.000Z'),
          errorType: 'ai_abandoned',
        },
      },
    ]);
  });

  it.each([
    ['2026-06-01T04:00:00.000Z', ['user-kyiv']],
    ['2026-06-01T04:59:59.999Z', ['user-kyiv']],
    ['2026-06-01T03:00:00.000Z', []],
    ['2026-06-01T05:00:00.000Z', []],
    ['2026-06-02T04:00:00.000Z', []],
    ['2026-06-01T07:00:00.000Z', ['user-utc']],
    ['2026-06-01T01:30:00.000Z', ['user-kolkata']],
    ['2026-06-01T01:00:00.000Z', []],
  ])(
    'picks for the monthly summary at %s only the users whose local time is 07:xx on the 1st',
    async (instant, userIds) => {
      clock.at(new Date(instant));

      await expect(service.monthlySummaryUsers()).resolves.toEqual(userIds);
      expect(log.parsed()).toEqual([
        expect.objectContaining({ count: userIds.length, msg: 'monthly summary users picked' }),
      ]);
    },
  );
});
