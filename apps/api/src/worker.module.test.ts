import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { describe, expect, it } from 'vitest';

import type { AppConfig } from './config/app-config.js';
import { MaintenanceProcessor } from './modules/maintenance/index.js';
import { stubQueues } from './test/stub-queues.js';
import { WorkerModule } from './worker.module.js';

describe('WorkerModule', () => {
  it('compiles with the validated config and the pino logger', async () => {
    const moduleRef = await stubQueues(
      Test.createTestingModule({ imports: [WorkerModule] }),
    ).compile();

    expect(moduleRef.get<AppConfig>(ConfigService).get('PORT', { infer: true })).toBe(4000);
    expect(moduleRef.get(Logger)).toBeInstanceOf(Logger);
    expect(moduleRef.get(MaintenanceProcessor, { strict: false })).toBeInstanceOf(
      MaintenanceProcessor,
    );

    await moduleRef.close();
  });
});
