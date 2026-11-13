import { randomUUID } from 'node:crypto';

import type { INestApplicationContext } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, type TestingModule, type TestingModuleBuilder } from '@nestjs/testing';
import type { QueueOptions } from 'bullmq';
import { Logger } from 'nestjs-pino';
import type { DestinationStream } from 'pino';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';

import { JwtKeys } from '../modules/auth/index.js';
import { WorkerModule } from '../worker.module.js';
import { appTestingModule, startTestApp } from './app.js';
import { authAs, testJwtKeys } from './auth.js';
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

export type DevJobCall = { path: string; requestId: string };

export async function queueDevJob(app: NestExpressApplication, { path, requestId }: DevJobCall) {
  const agent = await authAs(app, { id: randomUUID() });
  return agent.post(path).set('x-request-id', requestId).send({});
}

export type AppWithWorker = {
  readonly app: NestExpressApplication;
  readonly worker: INestApplicationContext;
  restartWorker: () => Promise<INestApplicationContext>;
};

function started<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('useAppWithWorker is read before its beforeAll ran');
  return value;
}

export function useAppWithWorker(sink: DestinationStream): AppWithWorker {
  const prefix = testQueuePrefix();
  let app: NestExpressApplication | undefined;
  let worker: INestApplicationContext | undefined;
  const startWorker = async () => {
    worker = await (await compileWorker(workerTestingModule(sink, { prefix }))).init();
    return worker;
  };

  beforeAll(async () => {
    app = await startTestApp(overrideBullConfig(withLogSink(appTestingModule(), sink), { prefix }));
    await startWorker();
  });

  afterAll(async () => {
    await worker?.close();
    if (app === undefined) return;
    await dropTestQueues(app);
    await app.close();
  });

  return {
    get app() {
      return started(app);
    },
    get worker() {
      return started(worker);
    },
    restartWorker: async () => {
      await worker?.close();
      return startWorker();
    },
  };
}
