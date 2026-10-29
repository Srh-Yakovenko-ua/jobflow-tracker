import { randomUUID } from 'node:crypto';

import { getQueueToken, getSharedConfigToken } from '@nestjs/bullmq';
import type { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TestingModuleBuilder } from '@nestjs/testing';
import type { Queue, QueueOptions } from 'bullmq';

import type { AppConfig } from '../config/app-config.js';
import { queueOptions, QUEUES } from '../queues/queues.js';

const TEST_QUEUE_PREFIX = 'bull-test-';

export const REFUSED_REDIS = {
  connection: { url: 'redis://127.0.0.1:1' },
} satisfies Partial<QueueOptions>;

const DROPPED_QUEUES = [QUEUES.maintenance.name, QUEUES.domainEvents.name];

export function testQueuePrefix(): string {
  return `${TEST_QUEUE_PREFIX}${randomUUID()}`;
}

export function overrideBullConfig(
  builder: TestingModuleBuilder,
  override: Partial<QueueOptions>,
): TestingModuleBuilder {
  return builder.overrideProvider(getSharedConfigToken()).useFactory({
    factory: (config: AppConfig) => ({ ...queueOptions(config), ...override }),
    inject: [ConfigService],
  });
}

async function dropTestQueue(queue: Queue): Promise<void> {
  if (!queue.opts.prefix?.startsWith(TEST_QUEUE_PREFIX)) {
    throw new Error(`Refusing to obliterate ${queue.name}: only a test-prefixed queue is dropped`);
  }
  await queue.obliterate({ force: true });
}

export async function dropTestQueues(moduleRef: INestApplicationContext): Promise<void> {
  await Promise.all(
    DROPPED_QUEUES.map((name) => dropTestQueue(moduleRef.get<Queue>(getQueueToken(name)))),
  );
}
