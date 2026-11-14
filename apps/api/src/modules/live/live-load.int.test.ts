import { setTimeout as delay } from 'node:timers/promises';

import { LIVE_EVENTS } from '@jobflow/shared';
import { buildJobUpdate } from '@jobflow/shared/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { User } from '../../generated/prisma/client.js';
import { RedisService } from '../../redis/redis.service.js';
import { useTestApp } from '../../test/app.js';
import { createUser } from '../../test/factories.js';
import { liveEventsOf, liveHubSubscribed, openLiveStream } from '../../test/live.js';
import type { SseStream } from '../../test/sse.js';
import { LIVE_STREAM_LIMITS } from './live-hub.service.js';
import { LivePublisher } from './live-publisher.js';

const USERS = 10;
const STREAMS = USERS * LIVE_STREAM_LIMITS.perUser;
const IDLE_WINDOW_MS = 2000;
const IDLE_WINDOWS = 3;
const SETTLE_MS = 1000;
const IDLE_CPU_ALLOWANCE_MS = 100;
const DELIVERY_LIMIT_MS = 1000;

async function idleCpuMs(): Promise<number> {
  const before = process.cpuUsage();
  await delay(IDLE_WINDOW_MS);
  const { user, system } = process.cpuUsage(before);
  return (user + system) / 1000;
}

async function lowestIdleCpuMs(): Promise<number> {
  const windows: number[] = [];
  for (let taken = 0; taken < IDLE_WINDOWS; taken += 1) {
    windows.push(await idleCpuMs());
  }
  return Math.min(...windows);
}

const reached = (streams: SseStream[]) => streams.filter(({ frames }) => frames.length > 0).length;

describe('fifty open live streams of one API instance', () => {
  const testApp = useTestApp();
  const streams: SseStream[] = [];

  async function subscriberConnections(): Promise<number> {
    const clients = await testApp.app.get(RedisService).client.client('LIST', 'TYPE', 'PUBSUB');
    return String(clients).trim().split('\n').filter(Boolean).length;
  }

  beforeAll(() => liveHubSubscribed(testApp.app));

  afterAll(() => Promise.all(streams.map((stream) => stream.close())));

  it("share one Redis subscriber connection, add no idle CPU and all receive their user's one event within a second", async () => {
    const users = await Promise.all(
      Array.from({ length: USERS }, () => createUser(testApp.prisma)),
    );
    const connectionsBefore = await subscriberConnections();
    const idleBefore = await lowestIdleCpuMs();
    const owners = users.flatMap((user) => Array<User>(LIVE_STREAM_LIMITS.perUser).fill(user));
    const opening = owners.map((owner) => openLiveStream(testApp.app, owner));
    streams.push(...(await Promise.all(opening)));

    await delay(SETTLE_MS);
    const idleWithStreams = await lowestIdleCpuMs();
    const connectionsWithStreams = await subscriberConnections();
    const publishedAt = Date.now();
    const event = { type: LIVE_EVENTS.jobUpdated, data: buildJobUpdate() };
    const publisher = testApp.app.get(LivePublisher);
    await Promise.all(users.map((user) => publisher.publish(user.id, event)));

    await expect.poll(() => reached(streams)).toBe(STREAMS);
    const lastArrival = Math.max(...streams.map(({ frames }) => frames[0]?.receivedAt ?? Infinity));
    expect(streams.map(({ status }) => status)).toEqual(Array.from({ length: STREAMS }, () => 200));
    expect(connectionsBefore).toBeGreaterThanOrEqual(1);
    expect(connectionsWithStreams).toBe(connectionsBefore);
    expect(idleWithStreams - idleBefore).toBeLessThan(IDLE_CPU_ALLOWANCE_MS);
    expect(lastArrival - publishedAt).toBeLessThan(DELIVERY_LIMIT_MS);
    expect(
      new Set(streams.flatMap(({ frames }) => liveEventsOf(frames)).map(({ id }) => id)).size,
    ).toBe(USERS);
  }, 30_000);
});
