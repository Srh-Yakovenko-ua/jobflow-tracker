import { getQueueToken } from '@nestjs/bullmq';
import type { INestApplicationContext } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { beforeEach, describe, expect, it } from 'vitest';

import type { ApplicationEvent } from '../modules/applications/index.js';
import { QUEUES } from '../queues/queues.js';
import { appTestingModule, useTestApp } from '../test/app.js';
import { postApplication, ROMASHKA, signedInWithSearch } from '../test/applications.js';
import { overrideBullConfig, REFUSED_REDIS } from '../test/bull-config.js';
import { memoryLog, withLogSink } from '../test/memory-log.js';
import {
  createOutboxRows,
  recordingHandler,
  relayWithinSettleLimit,
  unpublishedOutboxIds,
} from '../test/outbox.js';
import { useTestWorkers } from '../test/worker.js';
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
  const workers = useTestWorkers(log.sink);

  async function startWorker(): Promise<INestApplicationContext> {
    const worker = await workers.compile();
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
    recorder.events.length = 0;
  });

  it(
    'delivers all 10 events written while the queue Redis was down exactly once after it is back',
    { timeout: DELIVERY_TEST_TIMEOUT_MS },
    async () => {
      const { accessToken } = await signedInWithSearch(testApp.prisma);
      const statuses: number[] = [];
      for (let post = 0; post < 10; post += 1) {
        statuses.push(
          (await postApplication(testApp.app, { accessToken, input: ROMASHKA })).status,
        );
      }
      expect(statuses).toEqual(Array.from({ length: 10 }, () => 201));
      const outboxIds = await unpublishedOutboxIds(testApp.prisma);
      expect(outboxIds).toHaveLength(10);

      const refused = await workers.compile(REFUSED_REDIS);
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

      const started = await Promise.all([startWorker(), startWorker()]);
      await Promise.all(
        started.map((worker) => worker.get(OutboxRelayService, { strict: false }).relay()),
      );

      await expectDeliveredOnce(started[0], outboxIds);
    },
  );
});
