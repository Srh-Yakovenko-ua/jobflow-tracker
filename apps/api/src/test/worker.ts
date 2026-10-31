import { Test, type TestingModule, type TestingModuleBuilder } from '@nestjs/testing';
import type { QueueOptions } from 'bullmq';
import { Logger } from 'nestjs-pino';
import type { DestinationStream } from 'pino';

import { JwtKeys } from '../modules/auth/index.js';
import { WorkerModule } from '../worker.module.js';
import { testJwtKeys } from './auth.js';
import { overrideBullConfig } from './bull-config.js';
import { withLogSink } from './memory-log.js';

export function workerTestingModule(
  sink: DestinationStream,
  bull: Partial<QueueOptions> = {},
): TestingModuleBuilder {
  const testing = Test.createTestingModule({ imports: [WorkerModule] })
    .overrideProvider(JwtKeys)
    .useValue(testJwtKeys);
  return overrideBullConfig(withLogSink(testing, sink), bull);
}

export async function compileWorker(builder: TestingModuleBuilder): Promise<TestingModule> {
  const worker = await builder.compile();
  worker.useLogger(worker.get(Logger));
  return worker;
}
