import { ConfigService } from '@nestjs/config';
import type { TestingModule, TestingModuleBuilder } from '@nestjs/testing';
import type { QueueOptions } from 'bullmq';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { Clock } from '../common/clock.js';
import type { AppConfig } from '../config/app-config.js';
import type { ApplicationEvent } from '../modules/applications/index.js';
import { QUEUES } from '../queues/queues.js';
import { dropTestQueues, REFUSED_REDIS, testQueuePrefix } from '../test/bull-config.js';
import { useTestDatabase } from '../test/database.js';
import { memoryLog } from '../test/memory-log.js';
import {
  createOutboxRows,
  outboxPublication,
  outboxRows,
  RELAY_SETTLE_LIMIT_MS,
  relayWithinSettleLimit,
  unpublishedOutboxIds,
} from '../test/outbox.js';
import { HeldStubQueue, StubQueue, stubQueues } from '../test/stub-queues.js';
import { startTcpProxy, type TcpProxy } from '../test/tcp-proxy.js';
import { daysBefore, NOW, settableClock } from '../test/time.js';
import { compileWorker, workerTestingModule } from '../test/worker.js';
import { OutboxRelayService } from './outbox-relay.service.js';

const CREATED = 'application.created' satisfies ApplicationEvent['eventType'];

const STAGE_CHANGED = 'application.stage_changed' satisfies ApplicationEvent['eventType'];

const OUTAGE_TEST_TIMEOUT_MS = RELAY_SETTLE_LIMIT_MS + 5000;

type RelayContext = { moduleRef: TestingModule; relay: OutboxRelayService };

type Outage = { outage: OutboxRelayService; healthy: OutboxRelayService };

const log = memoryLog();

const clock = settableClock(NOW);

const database = useTestDatabase();

async function relayContext(builder: TestingModuleBuilder): Promise<RelayContext> {
  const moduleRef = await compileWorker(builder.overrideProvider(Clock).useValue(clock));
  return { moduleRef, relay: moduleRef.get(OutboxRelayService, { strict: false }) };
}

function stubbedRelay(domainEvents: StubQueue): Promise<RelayContext> {
  const stubs = { [QUEUES.domainEvents.name]: domainEvents };
  return relayContext(stubQueues(workerTestingModule(log.sink), stubs));
}

function redisRelay(bull: Partial<QueueOptions>): Promise<RelayContext> {
  return relayContext(workerTestingModule(log.sink, bull));
}

async function expectRowsToWaitOutTheOutage({ outage, healthy }: Outage): Promise<string[]> {
  await createOutboxRows(database.prisma, { count: 3, eventType: CREATED });
  const waiting = await unpublishedOutboxIds(database.prisma);

  await expect(relayWithinSettleLimit(outage)).rejects.toThrow('timed out after 2000 ms');
  expect(await unpublishedOutboxIds(database.prisma)).toEqual(waiting);

  expect(await healthy.relay()).toBe(3);
  expect(await unpublishedOutboxIds(database.prisma)).toEqual([]);
  return waiting;
}

beforeEach(() => {
  clock.at(NOW);
});

describe('OutboxRelayService on a healthy queue', () => {
  const queue = new StubQueue(QUEUES.domainEvents.name);
  let context: RelayContext;

  beforeAll(async () => {
    context = await stubbedRelay(queue);
  });

  beforeEach(() => {
    queue.jobs.length = 0;
  });

  afterAll(() => context.moduleRef.close());

  it('adds each unpublished row as a job named by its event type with the outbox id as job id, then stamps published_at', async () => {
    await createOutboxRows(database.prisma, {
      count: 2,
      eventType: CREATED,
      publishedAt: daysBefore(1),
    });
    await createOutboxRows(database.prisma, { count: 3, eventType: STAGE_CHANGED });
    const waiting = await unpublishedOutboxIds(database.prisma);
    const payloads = await outboxRows(database.prisma, { eventType: STAGE_CHANGED });

    expect(await context.relay.relay()).toBe(3);

    expect(queue.jobs).toEqual(
      waiting.map((id, index) => ({
        id,
        name: 'application.stage_changed',
        data: payloads[index]?.payload,
      })),
    );
    const published = await outboxPublication(database.prisma);
    expect(published.map(({ publishedAt }) => publishedAt)).toEqual([
      daysBefore(1),
      daysBefore(1),
      NOW,
      NOW,
      NOW,
    ]);
  });

  it('adds nothing on a pass after every row is published', async () => {
    await createOutboxRows(database.prisma, { count: 2, eventType: CREATED });
    expect(await context.relay.relay()).toBe(2);

    expect(await context.relay.relay()).toBe(0);
    expect(queue.jobs).toHaveLength(2);
  });

  it('deletes rows published more than 7 days ago and keeps newer and unpublished rows', async () => {
    await createOutboxRows(database.prisma, {
      count: 1,
      eventType: CREATED,
      createdAt: daysBefore(30),
    });
    await createOutboxRows(database.prisma, {
      count: 1,
      eventType: CREATED,
      createdAt: daysBefore(9),
      publishedAt: daysBefore(8),
    });
    await createOutboxRows(database.prisma, {
      count: 1,
      eventType: CREATED,
      createdAt: daysBefore(7),
      publishedAt: daysBefore(6),
    });

    expect(await context.relay.deletePublished()).toBe(1);

    const kept = await outboxPublication(database.prisma);
    expect(kept.map(({ publishedAt }) => publishedAt)).toEqual([null, daysBefore(6)]);
  });
});

describe('OutboxRelayService while the queue Redis refuses the connection', () => {
  const healthyQueue = new StubQueue(QUEUES.domainEvents.name);
  let refused: RelayContext;
  let healthy: RelayContext;

  beforeAll(async () => {
    refused = await redisRelay(REFUSED_REDIS);
    healthy = await stubbedRelay(healthyQueue);
  });

  afterAll(async () => {
    await refused.moduleRef.close();
    await healthy.moduleRef.close();
  });

  it(
    'rejects within the publish limit, keeps every row unpublished, and the next healthy pass publishes them',
    { timeout: OUTAGE_TEST_TIMEOUT_MS },
    async () => {
      const waiting = await expectRowsToWaitOutTheOutage({
        outage: refused.relay,
        healthy: healthy.relay,
      });

      expect(healthyQueue.jobs.map(({ id }) => id)).toEqual(waiting);
    },
  );
});

describe('OutboxRelayService while the queue Redis keeps the connection and never answers', () => {
  const prefix = testQueuePrefix();
  let proxy: TcpProxy;
  let silent: RelayContext;
  let healthy: RelayContext;

  beforeAll(async () => {
    healthy = await redisRelay({ prefix });
    const redisUrl = healthy.moduleRef
      .get<AppConfig>(ConfigService)
      .get('REDIS_URL', { infer: true });
    proxy = await startTcpProxy(redisUrl);
    silent = await redisRelay({ connection: { url: proxy.url }, prefix });
  });

  afterAll(async () => {
    await proxy.close();
    await silent.moduleRef.close();
    await dropTestQueues(healthy.moduleRef);
    await healthy.moduleRef.close();
  });

  it(
    'rejects within the publish limit once the open connection stops answering, and the next healthy pass publishes the rows',
    { timeout: OUTAGE_TEST_TIMEOUT_MS },
    async () => {
      await createOutboxRows(database.prisma, { count: 1, eventType: CREATED });
      expect(await silent.relay.relay()).toBe(1);
      proxy.silence();

      await expectRowsToWaitOutTheOutage({ outage: silent.relay, healthy: healthy.relay });
    },
  );
});

describe('two relay passes running at once', () => {
  const heldQueue = new HeldStubQueue(QUEUES.domainEvents.name);
  let context: RelayContext;

  beforeAll(async () => {
    context = await stubbedRelay(heldQueue);
  });

  afterAll(() => context.moduleRef.close());

  it('lets the second pass publish the rows the first one holds locked, so each of 150 rows goes out once', async () => {
    await createOutboxRows(database.prisma, { count: 150, eventType: CREATED });
    const waiting = await unpublishedOutboxIds(database.prisma);

    const first = context.relay.relay();
    await heldQueue.entered;
    expect(await context.relay.relay()).toBe(50);
    heldQueue.release();
    expect(await first).toBe(100);

    expect(heldQueue.jobs.map(({ id }) => id).sort()).toEqual([...waiting].sort());
    expect(await unpublishedOutboxIds(database.prisma)).toEqual([]);
  });
});
