import { Test, type TestingModule, type TestingModuleBuilder } from '@nestjs/testing';
import type { QueueOptions } from 'bullmq';
import { Logger } from 'nestjs-pino';
import type { DestinationStream } from 'pino';

import { WorkerModule } from '../worker.module.js';
import { overrideBullConfig } from './bull-config.js';
import { withLogSink } from './memory-log.js';

export function workerTestingModule(
  sink: DestinationStream,
  bull: Partial<QueueOptions> = {},
): TestingModuleBuilder {
  const builder = withLogSink(Test.createTestingModule({ imports: [WorkerModule] }), sink);
  return overrideBullConfig(builder, bull);
}

export async function compileWorker(builder: TestingModuleBuilder): Promise<TestingModule> {
  const worker = await builder.compile();
  worker.useLogger(worker.get(Logger));
  return worker;
}
