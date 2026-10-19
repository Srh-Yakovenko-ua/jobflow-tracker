import type { DefaultJobOptions, QueueOptions } from 'bullmq';

import type { AppConfig } from '../config/app-config.js';

export const QUEUES = {
  ai: { name: 'ai', concurrency: 2 },
  notifications: { name: 'notifications', concurrency: 5 },
  push: { name: 'push', concurrency: 10 },
  domainEvents: { name: 'domain-events', concurrency: 5 },
  maintenance: { name: 'maintenance', concurrency: 1 },
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES]['name'];

export const QUEUE_NAMES: QueueName[] = Object.values(QUEUES).map((queue) => queue.name);

export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { age: 86_400 },
  removeOnFail: { age: 604_800 },
} as const satisfies DefaultJobOptions;

export function queueOptions(config: AppConfig): QueueOptions {
  const url = config.get('REDIS_URL', { infer: true });
  return {
    connection: { url },
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  };
}
