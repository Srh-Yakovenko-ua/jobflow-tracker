import { EventEmitter } from 'node:events';

import { LIVE_EVENTS, type LiveEvent } from '@jobflow/shared';
import { buildJobUpdate } from '@jobflow/shared/testing';
import type { MessageEvent } from '@nestjs/common';
import { addSeconds } from 'date-fns';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RedisService } from '../../redis/redis.service.js';
import { FakeDependency } from '../../test/fake-dependency.js';
import { liveUserOf } from '../../test/live.js';
import { memoryLog } from '../../test/memory-log.js';
import { compileProcessorModule } from '../../test/processor.js';
import { BOHDAN_ID, MOVE_EVENT_ID, OLENA_ID } from '../../test/service-fixtures.js';
import type { AccessUser } from '../auth/index.js';
import { LiveHub } from './live-hub.service.js';

const HEARTBEAT_MS = 25_000;

const STREAM_MAX_MS = 900_000;

const JOB_DONE: LiveEvent = {
  id: MOVE_EVENT_ID,
  type: LIVE_EVENTS.jobUpdated,
  data: buildJobUpdate({ status: 'done', step: 3 }),
};

const HEARTBEAT = { comment: 'heartbeat' };

class FakeSubscriber extends EventEmitter {
  readonly patterns: string[] = [];

  refusal: Error | undefined;

  disconnected = false;

  psubscribe(pattern: string): Promise<number> {
    if (this.refusal !== undefined) {
      return Promise.reject(this.refusal);
    }
    this.patterns.push(pattern);
    return Promise.resolve(1);
  }

  disconnect(): void {
    this.disconnected = true;
  }

  deliver(userId: string, message: string): void {
    this.emit('pmessage', 'user:*', `user:${userId}`, message);
  }
}

class FakeRedis extends FakeDependency {
  readonly subscriber = new FakeSubscriber();

  readonly client = { duplicate: () => this.subscriber };
}

const log = memoryLog();

function openedAs(hub: LiveHub, user: AccessUser) {
  const stream = { messages: [] as MessageEvent[], ended: false, error: undefined as unknown };
  hub.stream(user).subscribe({
    next: (message) => stream.messages.push(message),
    complete: () => {
      stream.ended = true;
    },
    error: (error: unknown) => {
      stream.error = error;
    },
  });
  return stream;
}

const opened = (hub: LiveHub, userId: string) => openedAs(hub, liveUserOf(userId));

const expiringIn = (userId: string, seconds: number) =>
  liveUserOf(userId, addSeconds(new Date(), seconds));

describe('LiveHub', () => {
  let redis: FakeRedis;
  let hub: LiveHub;

  beforeEach(async () => {
    log.lines.length = 0;
    redis = new FakeRedis();
    const moduleRef = await compileProcessorModule(log.sink, [
      LiveHub,
      { provide: RedisService, useValue: redis },
    ]);
    hub = moduleRef.get(LiveHub);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('subscribes to user:* again on every ready event of its connection', () => {
    redis.subscriber.emit('ready');
    redis.subscriber.emit('ready');

    expect(redis.subscriber.patterns).toEqual(['user:*', 'user:*']);
  });

  it('logs a refused subscription and subscribes on the next ready', async () => {
    redis.subscriber.refusal = new Error('Connection is closed.');
    redis.subscriber.emit('ready');
    await vi.advanceTimersByTimeAsync(0);
    redis.subscriber.refusal = undefined;
    redis.subscriber.emit('ready');

    expect(redis.subscriber.patterns).toEqual(['user:*']);
    expect(log.parsed()).toEqual([
      expect.objectContaining({ level: 40, msg: 'live subscription failed' }),
    ]);
  });

  it("hands an event from the user's channel to the user's stream with its id, type and data, and to no other user", () => {
    const olena = opened(hub, OLENA_ID);
    const bohdan = opened(hub, BOHDAN_ID);

    redis.subscriber.deliver(OLENA_ID, JSON.stringify(JOB_DONE));

    expect(olena.messages).toEqual([
      { id: MOVE_EVENT_ID, type: 'job.updated', data: JOB_DONE.data },
    ]);
    expect(bohdan.messages).toEqual([]);
  });

  it.each([
    { payload: 'that is not JSON', message: 'job.updated for 0199f1a0' },
    { payload: 'without an id', message: JSON.stringify({ ...JOB_DONE, id: undefined }) },
    { payload: 'of an unknown type', message: JSON.stringify({ ...JOB_DONE, type: 'job.gone' }) },
  ])('drops a payload $payload with one warning that leaves it out', ({ message }) => {
    const olena = opened(hub, OLENA_ID);

    redis.subscriber.deliver(OLENA_ID, message);

    expect(olena.messages).toEqual([]);
    expect(log.parsed()).toEqual([
      expect.objectContaining({ level: 40, msg: 'live event dropped' }),
    ]);
    expect(log.lines.join('')).not.toContain('0199f1a0');
  });

  it('sends a heartbeat comment without an id every 25 s', async () => {
    const olena = opened(hub, OLENA_ID);

    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS - 1);
    const beforeTheFirst = [...olena.messages];
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS + 1);

    expect(beforeTheFirst).toEqual([]);
    expect(olena.messages).toEqual([HEARTBEAT, HEARTBEAT]);
  });

  it('runs one heartbeat timer for three open streams, next to their three lifetime timers', () => {
    opened(hub, OLENA_ID);
    opened(hub, OLENA_ID);
    opened(hub, BOHDAN_ID);

    expect(vi.getTimerCount()).toBe(4);
  });

  it('ends every open stream when Redis does not answer at a heartbeat, and serves a stream opened after it', async () => {
    const olena = opened(hub, OLENA_ID);
    const bohdan = opened(hub, BOHDAN_ID);
    redis.up = false;

    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
    const reconnected = opened(hub, OLENA_ID);
    redis.subscriber.deliver(OLENA_ID, JSON.stringify(JOB_DONE));

    expect([olena.ended, bohdan.ended, reconnected.ended]).toEqual([true, true, false]);
    expect(reconnected.messages).toHaveLength(1);
  });

  it('ends every open stream when its subscriber connection closes', () => {
    const olena = opened(hub, OLENA_ID);
    const bohdan = opened(hub, BOHDAN_ID);

    redis.subscriber.emit('close');

    expect([olena.ended, bohdan.ended]).toEqual([true, true]);
  });

  it('ends a stream opened after its subscriber connection closed once the subscription is back', async () => {
    redis.subscriber.emit('close');
    const olena = opened(hub, OLENA_ID);

    redis.subscriber.emit('ready');
    await vi.advanceTimersByTimeAsync(0);

    expect(olena.ended).toBe(true);
  });

  it('keeps a stream opened after its connection closed until a subscription succeeds, past a refused one', async () => {
    redis.subscriber.emit('close');
    const olena = opened(hub, OLENA_ID);
    redis.subscriber.refusal = new Error('Connection is closed.');

    redis.subscriber.emit('ready');
    await vi.advanceTimersByTimeAsync(0);
    const afterRefusal = olena.ended;
    redis.subscriber.refusal = undefined;
    redis.subscriber.emit('ready');
    await vi.advanceTimersByTimeAsync(0);

    expect([afterRefusal, olena.ended]).toEqual([false, true]);
  });

  it('keeps a stream opened before the first subscription at boot open and hands it the events after it', async () => {
    const olena = opened(hub, OLENA_ID);

    redis.subscriber.emit('ready');
    await vi.advanceTimersByTimeAsync(0);
    redis.subscriber.deliver(OLENA_ID, JSON.stringify(JOB_DONE));

    expect(olena.messages).toHaveLength(1);
    expect(olena.ended).toBe(false);
  });

  it('keeps a stream opened under a live subscription open when the subscriber subscribes again', async () => {
    redis.subscriber.emit('ready');
    await vi.advanceTimersByTimeAsync(0);
    const olena = opened(hub, OLENA_ID);

    redis.subscriber.emit('ready');
    await vi.advanceTimersByTimeAsync(0);

    expect(olena.ended).toBe(false);
  });

  it('keeps the streams open while Redis answers at a heartbeat', async () => {
    const olena = opened(hub, OLENA_ID);

    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);

    expect(olena.ended).toBe(false);
  });

  it('ends a stream 900 s after it opened and leaves a younger one open', async () => {
    const older = opened(hub, OLENA_ID);
    await vi.advanceTimersByTimeAsync(STREAM_MAX_MS / 2);
    const younger = opened(hub, OLENA_ID);

    await vi.advanceTimersByTimeAsync(STREAM_MAX_MS / 2 - 1);
    const justBefore = older.ended;
    await vi.advanceTimersByTimeAsync(1);

    expect([justBefore, older.ended, younger.ended]).toEqual([false, true, false]);
  });

  it('ends a stream when the access token behind its ticket expires, before its 900 s', async () => {
    const olena = openedAs(hub, expiringIn(OLENA_ID, 60));

    await vi.advanceTimersByTimeAsync(59_999);
    const justBefore = olena.ended;
    await vi.advanceTimersByTimeAsync(1);

    expect([justBefore, olena.ended]).toEqual([false, true]);
  });

  it("refuses a user's sixth open stream with 429, opens another user's, and opens one again once a stream ended", async () => {
    const expiring = openedAs(hub, expiringIn(OLENA_ID, 60));
    const open = [1, 2, 3, 4].map(() => opened(hub, OLENA_ID));
    const sixth = opened(hub, OLENA_ID);
    const bohdan = opened(hub, BOHDAN_ID);

    await vi.advanceTimersByTimeAsync(60_000);
    const afterOneEnded = opened(hub, OLENA_ID);

    expect(sixth.error).toMatchObject({
      body: { status: 429, type: 'rate_limited', detail: 'Too many open live streams' },
    });
    expect([...open, bohdan, afterOneEnded].map(({ error }) => error)).toEqual(
      Array.from({ length: 6 }, () => undefined),
    );
    expect([expiring.ended, afterOneEnded.ended]).toEqual([true, false]);
  });

  it('ends the open streams and closes its connection when the module is destroyed', () => {
    const olena = opened(hub, OLENA_ID);

    hub.onModuleDestroy();

    expect(olena.ended).toBe(true);
    expect(redis.subscriber.disconnected).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
