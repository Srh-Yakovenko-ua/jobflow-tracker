import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { MaintenanceScheduler } from './maintenance.scheduler.js';

const PUSH_URL = 'http://uptime-kuma:3001/api/push/f6c2a9e04b7d';

type SchedulerUpsert = [id: string, repeat: unknown, template: unknown];

class RecordingSchedulerQueue {
  readonly upserted: SchedulerUpsert[] = [];

  readonly removed: string[] = [];

  upsertJobScheduler(...upsert: SchedulerUpsert): Promise<void> {
    this.upserted.push(upsert);
    return Promise.resolve();
  }

  removeJobScheduler(id: string): Promise<boolean> {
    this.removed.push(id);
    return Promise.resolve(true);
  }
}

async function bootedScheduler(pushUrl?: string) {
  const queue = new RecordingSchedulerQueue();
  const moduleRef = await Test.createTestingModule({
    providers: [
      MaintenanceScheduler,
      { provide: getQueueToken('maintenance'), useValue: queue },
      { provide: ConfigService, useValue: new ConfigService({ UPTIME_KUMA_PUSH_URL: pushUrl }) },
    ],
  }).compile();
  await moduleRef.get(MaintenanceScheduler).onApplicationBootstrap();
  return queue;
}

const uptimeUpserts = (queue: RecordingSchedulerQueue) =>
  queue.upserted.filter(([id]) => id === 'uptime-push');

describe('MaintenanceScheduler', () => {
  it('schedules one uptime push a minute carrying the push URL when it is set', async () => {
    const queue = await bootedScheduler(PUSH_URL);

    expect(uptimeUpserts(queue)).toEqual([
      [
        'uptime-push',
        { every: 60_000 },
        {
          name: 'uptime.push',
          data: { url: PUSH_URL },
          opts: { attempts: 1, removeOnComplete: true, removeOnFail: { count: 100 } },
        },
      ],
    ]);
    expect(queue.removed).toEqual([]);
  });

  it('removes a stale uptime push schedule and adds none when the push URL is unset', async () => {
    const queue = await bootedScheduler();

    expect(uptimeUpserts(queue)).toEqual([]);
    expect(queue.removed).toEqual(['uptime-push']);
  });
});
