import { randomUUID } from 'node:crypto';

import { getSharedConfigToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import type { TestingModuleBuilder } from '@nestjs/testing';
import type { QueueOptions } from 'bullmq';

import type { AppConfig } from '../config/app-config.js';
import { queueOptions } from '../queues/queues.js';

export function testQueuePrefix(): string {
  return `bull-test-${randomUUID()}`;
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
