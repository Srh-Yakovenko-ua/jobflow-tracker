import { Test, type TestingModule, type TestingModuleBuilder } from '@nestjs/testing';
import type { QueueOptions } from 'bullmq';
import { Logger } from 'nestjs-pino';
import type { DestinationStream } from 'pino';
import { afterEach, beforeEach } from 'vitest';

import { JwtKeys } from '../modules/auth/index.js';
import { WorkerModule } from '../worker.module.js';
import { testJwtKeys } from './auth.js';
import { dropTestQueues, overrideBullConfig, testQueuePrefix } from './bull-config.js';
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

export type TestWorkers = { compile: (bull?: Partial<QueueOptions>) => Promise<TestingModule> };

export type WorkerOverrides = (builder: TestingModuleBuilder) => TestingModuleBuilder;

export function useTestWorkers(
  sink: DestinationStream,
  override: WorkerOverrides = (builder) => builder,
): TestWorkers {
  const contexts: TestingModule[] = [];
  let prefix = testQueuePrefix();

  beforeEach(() => {
    prefix = testQueuePrefix();
  });

  afterEach(async () => {
    await Promise.all(contexts.splice(0).map((moduleRef) => moduleRef.close()));
    const cleaner = await compileWorker(workerTestingModule(sink, { prefix }));
    await dropTestQueues(cleaner);
    await cleaner.close();
  });

  return {
    compile: async (bull = { prefix }) => {
      const moduleRef = await compileWorker(override(workerTestingModule(sink, bull)));
      contexts.push(moduleRef);
      return moduleRef;
    },
  };
}
