import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { describe, expect, it } from 'vitest';

import type { AppConfig } from './config/app-config.js';
import { MaintenanceProcessor, MaintenanceScheduler } from './modules/maintenance/index.js';
import { DomainEventsProcessor } from './outbox/domain-events.processor.js';
import { stubQueues } from './test/stub-queues.js';
import { WorkerModule } from './worker.module.js';

describe('WorkerModule', () => {
  it('compiles with the validated config, the pino logger, the processors and the scheduler', async () => {
    const moduleRef = await stubQueues(
      Test.createTestingModule({ imports: [WorkerModule] }),
    ).compile();

    expect(moduleRef.get<AppConfig>(ConfigService).get('PORT', { infer: true })).toBe(4000);
    expect(moduleRef.get(Logger)).toBeInstanceOf(Logger);
    for (const provider of [MaintenanceProcessor, DomainEventsProcessor, MaintenanceScheduler]) {
      expect(moduleRef.get(provider, { strict: false })).toBeInstanceOf(provider);
    }

    await moduleRef.close();
  });
});
