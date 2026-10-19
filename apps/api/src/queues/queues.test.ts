import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';

import type { AppConfig } from '../config/app-config.js';
import { DEFAULT_JOB_OPTIONS, QUEUE_NAMES, queueOptions, QUEUES } from './queues.js';

describe('QUEUES', () => {
  it('runs ai at 2, notifications at 5, push at 10, domain-events at 5 and maintenance at 1', () => {
    const rows = Object.entries(QUEUES).map(
      ([key, { name, concurrency }]) => `${key} ${name} ${String(concurrency)}`,
    );

    expect(rows).toEqual([
      'ai ai 2',
      'notifications notifications 5',
      'push push 10',
      'domainEvents domain-events 5',
      'maintenance maintenance 1',
    ]);
  });

  it('lists the five queue names', () => {
    expect(QUEUE_NAMES).toEqual(['ai', 'notifications', 'push', 'domain-events', 'maintenance']);
  });
});

describe('DEFAULT_JOB_OPTIONS', () => {
  it('tries 3 times with exponential backoff from 5 s, keeps completed 24 h and failed 7 days', () => {
    expect(DEFAULT_JOB_OPTIONS).toEqual({
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 86400 },
      removeOnFail: { age: 604800 },
    });
  });
});

describe('queueOptions', () => {
  it('connects through REDIS_URL and applies the default job options to every queue', () => {
    const config: AppConfig = new ConfigService({ REDIS_URL: 'rediss://:p%40ss@cache:6380/2' });

    expect(queueOptions(config)).toEqual({
      connection: { url: 'rediss://:p%40ss@cache:6380/2' },
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
  });
});
