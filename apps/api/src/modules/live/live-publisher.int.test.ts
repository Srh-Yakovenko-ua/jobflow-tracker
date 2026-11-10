import { once } from 'node:events';

import { LIVE_EVENTS, liveEventSchema } from '@jobflow/shared';
import { buildJobUpdate } from '@jobflow/shared/testing';
import { afterEach, describe, expect, it } from 'vitest';

import { DEPENDENCY_LIMITS } from '../../common/probe.js';
import { RedisService } from '../../redis/redis.service.js';
import { configuredRedisUrl, redisAt } from '../../test/live.js';
import { memoryLog } from '../../test/memory-log.js';
import { compileProcessorModule } from '../../test/processor.js';
import { outcomeWithin, startTcpProxy } from '../../test/tcp-proxy.js';
import { LivePublisher } from './live-publisher.js';

const USER_ID = '0199f4b1-2c3d-7e4f-8a51-6b7c8d9e0f1d';
const JOB_UPDATE = buildJobUpdate({ status: 'done', step: 3 });
const EVENT = { type: LIVE_EVENTS.jobUpdated, data: JOB_UPDATE };
const ANSWER_LIMIT_MS = DEPENDENCY_LIMITS.pingTimeoutMs * 2;

describe('LivePublisher', () => {
  const cleanups: (() => unknown)[] = [];

  const log = memoryLog();
  const unpublished = () => log.parsed().filter(({ msg }) => msg === 'live event not published');

  async function publisherOn(redis: RedisService): Promise<LivePublisher> {
    const moduleRef = await compileProcessorModule(log.sink, [
      LivePublisher,
      { provide: RedisService, useValue: redis },
    ]);
    log.lines.length = 0;
    return moduleRef.get(LivePublisher);
  }

  async function expectOneWarningAndNoPayload(redis: RedisService): Promise<void> {
    const publisher = await publisherOn(redis);

    const outcome = await outcomeWithin(publisher.publish(USER_ID, EVENT), ANSWER_LIMIT_MS);

    expect(outcome).toBe('answered');
    expect(unpublished()).toEqual([
      expect.objectContaining({ level: 40, userId: USER_ID, type: 'job.updated' }),
    ]);
    expect(log.lines.join('')).not.toContain(JOB_UPDATE.id);
  }

  afterEach(async () => {
    for (const cleanup of cleanups.splice(0).reverse()) {
      await cleanup();
    }
  });

  it("publishes the event with a uuid id to the user's channel", async () => {
    const redis = redisAt(await configuredRedisUrl());
    const subscriber = redis.client.duplicate();
    cleanups.push(
      () => redis.onModuleDestroy(),
      () => {
        subscriber.disconnect();
      },
    );
    const messages: string[] = [];
    subscriber.on('message', (_channel: string, message: string) => messages.push(message));
    await Promise.all([once(redis.client, 'ready'), once(subscriber, 'ready')]);
    await subscriber.subscribe(`user:${USER_ID}`);
    const publisher = await publisherOn(redis);

    await publisher.publish(USER_ID, EVENT);

    await expect.poll(() => messages.length).toBe(1);
    const { id, ...event } = liveEventSchema.parse(JSON.parse(messages[0] ?? 'null'));
    expect(event).toEqual({ type: 'job.updated', data: JOB_UPDATE });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('resolves with one warning and no payload in the log while Redis refuses the connection', async () => {
    const redis = redisAt('redis://127.0.0.1:1');
    cleanups.push(() => redis.onModuleDestroy());

    await expectOneWarningAndNoPayload(redis);
  });

  it('resolves within the answer limit with one warning while Redis never answers', async () => {
    const proxy = await startTcpProxy(await configuredRedisUrl());
    const redis = redisAt(proxy.url);
    cleanups.push(
      () => proxy.close(),
      () => {
        redis.client.disconnect();
      },
    );
    await once(redis.client, 'ready');
    proxy.silence();

    await expectOneWarningAndNoPayload(redis);
  });
});
