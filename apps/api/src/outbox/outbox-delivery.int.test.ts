import { getQueueToken } from '@nestjs/bullmq';
import type { INestApplicationContext } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import type { Queue, QueueOptions } from 'bullmq';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ApplicationEvent } from '../modules/applications/index.js';
import { QUEUES } from '../queues/queues.js';
import { appTestingModule, useTestApp } from '../test/app.js';
import { postApplication, ROMASHKA, signedInWithSearch } from '../test/applications.js';
import {
  dropTestQueues,
  overrideBullConfig,
  REFUSED_REDIS,
  testQueuePrefix,
} from '../test/bull-config.js';
import { memoryLog, withLogSink } from '../test/memory-log.js';
import {
  createOutboxRows,
  recordingHandler,
  relayWithinSettleLimit,
  unpublishedOutboxIds,
} from '../test/outbox.js';
import { compileWorker, workerTestingModule } from '../test/worker.js';
import { DomainEventRouter } from './domain-event-router.js';
import { OutboxRelayService } from './outbox-relay.service.js';

const CREATED = 'application.created' satisfies ApplicationEvent['eventType'];

const DRAINED = { unpublished: 0, waiting: 0, active: 0, delayed: 0 };

const DELIVERY_TEST_TIMEOUT_MS = 30_000;

const log = memoryLog();

const recorder = recordingHandler();

describe('domain events relayed from the outbox to the subscribers by the worker', () => {
  const testApp = useTestApp(() =>
    overrideBullConfig(withLogSink(appTestingModule(), log.sink), REFUSED_REDIS),
  );
  const contexts: TestingModule[] = [];
  let prefix = testQueuePrefix();

  async function compiled(bull: Partial<QueueOptions>): Promise<TestingModule> {
    const moduleRef = await compileWorker(workerTestingModule(log.sink, bull));
    contexts.push(moduleRef);
    return moduleRef;
  }

  async function startWorker(): Promise<INestApplicationContext> {
    const worker = await compiled({ prefix });
    worker.get(DomainEventRouter, { strict: false }).subscribe(CREATED, recorder.handle);
    return worker.init();
  }

  async function backlog(worker: INestApplicationContext) {
    const domainEvents = worker.get<Queue>(getQueueToken(QUEUES.domainEvents.name));
    const counts = await domainEvents.getJobCounts('waiting', 'active', 'delayed');
    const unpublished = (await unpublishedOutboxIds(testApp.prisma)).length;
    return { unpublished, ...counts };
  }

  async function expectDeliveredOnce(worker: INestApplicationContext, outboxIds: string[]) {
    await expect.poll(() => backlog(worker), { timeout: 20_000 }).toEqual(DRAINED);
    expect(recorder.events).toHaveLength(outboxIds.length);
    expect(recorder.events.map(({ id }) => id).sort()).toEqual([...outboxIds].sort());
    expect(new Set(recorder.events.map(({ type }) => type))).toEqual(new Set([CREATED]));
  }

  beforeEach(() => {
    prefix = testQueuePrefix();
    recorder.events.length = 0;
  });

  afterEach(async () => {
    await Promise.all(contexts.splice(0).map((moduleRef) => moduleRef.close()));
    const cleaner = await compileWorker(workerTestingModule(log.sink, { prefix }));
    await dropTestQueues(cleaner);
    await cleaner.close();
  });

  it(
    'delivers all 10 events written while the queue Redis was down exactly once after it is back',
    { timeout: DELIVERY_TEST_TIMEOUT_MS },
    async () => {
      const { accessToken } = await signedInWithSearch(testApp.prisma);
      const responses = await Promise.all(
        Array.from({ length: 10 }, () =>
          postApplication(testApp.app, { accessToken, input: ROMASHKA }),
        ),
      );
      expect(responses.map(({ status }) => status)).toEqual(Array.from({ length: 10 }, () => 201));
      const outboxIds = await unpublishedOutboxIds(testApp.prisma);
      expect(outboxIds).toHaveLength(10);

      const refused = await compiled(REFUSED_REDIS);
      const refusedRelay = refused.get(OutboxRelayService, { strict: false });
      await expect(relayWithinSettleLimit(refusedRelay)).rejects.toThrow('timed out after 2000 ms');
      expect(await unpublishedOutboxIds(testApp.prisma)).toEqual(outboxIds);

      await expectDeliveredOnce(await startWorker(), outboxIds);
    },
  );

  it(
    'delivers 250 events once each while two worker instances relay and consume them',
    { timeout: DELIVERY_TEST_TIMEOUT_MS },
    async () => {
      await createOutboxRows(testApp.prisma, { count: 250, eventType: CREATED });
      const outboxIds = await unpublishedOutboxIds(testApp.prisma);

      const workers = await Promise.all([startWorker(), startWorker()]);
      await Promise.all(
        workers.map((worker) => worker.get(OutboxRelayService, { strict: false }).relay()),
      );

      await expectDeliveredOnce(workers[0], outboxIds);
    },
  );
});
