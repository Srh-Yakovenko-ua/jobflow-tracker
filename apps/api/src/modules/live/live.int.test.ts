import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

import { errorResponseSchema, LIVE_EVENTS } from '@jobflow/shared';
import { buildJobUpdate } from '@jobflow/shared/testing';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { DEPENDENCY_LIMITS } from '../../common/probe.js';
import type { AppConfig } from '../../config/app-config.js';
import { RedisService } from '../../redis/redis.service.js';
import { appTestingModule, startTestApp, useTestApp } from '../../test/app.js';
import { accessTokenFor } from '../../test/auth.js';
import { createUser } from '../../test/factories.js';
import { callRoute } from '../../test/http.js';
import {
  configuredRedisUrl,
  issueLiveTicket,
  LIVE_PATHS,
  liveEventsOf,
  liveHubSubscribed,
  openLiveStream,
  redisAt,
  streamPathOf,
} from '../../test/live.js';
import { openSse, type SseStream } from '../../test/sse.js';
import { startTcpProxy, type TcpProxy } from '../../test/tcp-proxy.js';
import { LivePublisher } from './live-publisher.js';

const APPLICATION_ID = '0199f0c4-6e3f-7c42-9d50-7b8c9d0e1f2a';
const NOTIFICATION_ID = '0199f4b1-2c3d-7e4f-8a51-6b7c8d9e0f1c';
const USER_ID = '0199f4b1-2c3d-7e4f-8a51-6b7c8d9e0f1d';

const UNAUTHORIZED = { status: 401, type: 'unauthorized', detail: 'Invalid live ticket' };

const ticketKeyOf = (ticket: string) =>
  `events-ticket:${createHash('sha256').update(ticket).digest('hex')}`;

describe('the live stream and its one-time ticket', () => {
  const testApp = useTestApp();
  const streams: SseStream[] = [];

  const redis = () => testApp.app.get(RedisService).client;

  async function opened(opening: Promise<SseStream>): Promise<SseStream> {
    const stream = await opening;
    streams.push(stream);
    return stream;
  }

  const streamOf = (ticket: string, headers?: Record<string, string>) =>
    opened(openSse(testApp.app, { path: streamPathOf(ticket), headers }));

  async function refusal(stream: SseStream) {
    const { requestId, ...body } = errorResponseSchema.parse(await stream.errorBody());
    expect(requestId).not.toBe('');
    return body;
  }

  beforeAll(() => liveHubSubscribed(testApp.app));

  afterEach(async () => {
    await Promise.all(streams.splice(0).map((stream) => stream.close()));
  });

  it('opens the stream with a fresh ticket and answers 401 to the same ticket again', async () => {
    const { ticket } = await issueLiveTicket(testApp.app, await createUser(testApp.prisma));

    const first = await streamOf(ticket);
    const second = await streamOf(ticket);

    expect([first.status, first.header('content-type'), second.status]).toEqual([
      200,
      'text/event-stream',
      401,
    ]);
    expect(await refusal(second)).toMatchObject(UNAUTHORIZED);
  });

  it('opens the stream for the web origin with its CORS headers', async () => {
    const origin = testApp.app.get<AppConfig>(ConfigService).get('WEB_ORIGIN', { infer: true });
    const { ticket } = await issueLiveTicket(testApp.app, await createUser(testApp.prisma));

    const stream = await streamOf(ticket, { origin });

    expect([stream.status, stream.header('access-control-allow-origin')]).toEqual([200, origin]);
  });

  it('keeps only the SHA-256 of the ticket in Redis, for 30 seconds at most', async () => {
    const issued = await issueLiveTicket(testApp.app, await createUser(testApp.prisma));

    const ttl = await redis().ttl(ticketKeyOf(issued.ticket));

    expect(issued.expiresInSeconds).toBe(30);
    expect([ttl > 0, ttl <= 30]).toEqual([true, true]);
    expect(await redis().keys(`*${issued.ticket}*`)).toEqual([]);
  });

  it('answers 401 to a ticket that has expired', async () => {
    const { ticket } = await issueLiveTicket(testApp.app, await createUser(testApp.prisma));
    await redis().pexpire(ticketKeyOf(ticket), 1);
    await expect.poll(() => redis().exists(ticketKeyOf(ticket))).toBe(0);

    const stream = await streamOf(ticket);

    expect(await refusal(stream)).toMatchObject(UNAUTHORIZED);
  });

  it.each([
    { name: 'an unknown ticket', query: '?ticket=never-issued' },
    { name: 'an empty ticket', query: '?ticket=' },
    { name: 'no ticket', query: '' },
    { name: 'a ticket longer than 128 characters', query: `?ticket=${'a'.repeat(129)}` },
  ])('answers 401 to $name', async ({ query }) => {
    const stream = await opened(openSse(testApp.app, { path: `${LIVE_PATHS.stream}${query}` }));

    expect(await refusal(stream)).toMatchObject(UNAUTHORIZED);
  });

  it('answers 401 to a ticket request without an access token', async () => {
    const response = await callRoute(testApp.app, { method: 'post', path: LIVE_PATHS.ticket });

    expect(errorResponseSchema.parse(response.body)).toMatchObject({ status: 401 });
  });

  it('answers 403 to a ticket request with a token that lacks the user scope', async () => {
    const user = await createUser(testApp.prisma);
    const accessToken = await accessTokenFor(user, { scope: ['capture'] });

    const response = await callRoute(testApp.app, {
      method: 'post',
      path: LIVE_PATHS.ticket,
      accessToken,
    });

    expect(errorResponseSchema.parse(response.body)).toMatchObject({ status: 403 });
  });

  it("delivers a user's three event types with id, name and data, and none of them to another user", async () => {
    const [olena, bohdan] = [await createUser(testApp.prisma), await createUser(testApp.prisma)];
    const olenaStream = await opened(openLiveStream(testApp.app, olena));
    const bohdanStream = await opened(openLiveStream(testApp.app, bohdan));
    const publisher = testApp.app.get(LivePublisher);
    const jobUpdate = buildJobUpdate({ status: 'done', step: 3 });
    const applicationUpdate = { applicationId: APPLICATION_ID, fields: ['company', 'position'] };
    const notification = { notificationId: NOTIFICATION_ID };

    await publisher.publish(olena.id, { type: LIVE_EVENTS.jobUpdated, data: jobUpdate });
    await publisher.publish(olena.id, {
      type: LIVE_EVENTS.applicationUpdated,
      data: applicationUpdate,
    });
    await publisher.publish(olena.id, {
      type: LIVE_EVENTS.notificationCreated,
      data: notification,
    });
    await publisher.publish(bohdan.id, {
      type: LIVE_EVENTS.notificationCreated,
      data: notification,
    });

    await expect.poll(() => bohdanStream.frames.length).toBe(1);
    await expect.poll(() => olenaStream.frames.length).toBe(3);
    const received = liveEventsOf(olenaStream.frames);
    expect(received.map(({ type, data }) => ({ type, data }))).toEqual([
      { type: 'job.updated', data: jobUpdate },
      { type: 'application.updated', data: applicationUpdate },
      { type: 'notification.created', data: notification },
    ]);
    expect(new Set(received.map(({ id }) => id)).size).toBe(3);
    expect(liveEventsOf(bohdanStream.frames).map(({ type }) => type)).toEqual([
      'notification.created',
    ]);
  });
});

const ANSWER_LIMIT_MS = DEPENDENCY_LIMITS.pingTimeoutMs * 2;

async function expectNotReadyInTime(app: NestExpressApplication): Promise<void> {
  const accessToken = await accessTokenFor({ id: USER_ID });
  const ticket = callRoute(app, { method: 'post', path: LIVE_PATHS.ticket, accessToken });
  const stream = callRoute(app, { method: 'get', path: streamPathOf('any-ticket') });
  const answers = [ticket, stream].map((call) =>
    Promise.race([
      call.then(({ body }) => errorResponseSchema.parse(body).type),
      delay(ANSWER_LIMIT_MS, 'still pending', { ref: false }),
    ]),
  );

  expect(await Promise.all(answers)).toEqual(['not_ready', 'not_ready']);
}

describe('the live routes while Redis refuses the connection', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const redis = redisAt('redis://127.0.0.1:1');
    app = await startTestApp(appTestingModule().overrideProvider(RedisService).useValue(redis));
  });

  afterAll(() => app.close());

  it('answer 503 to the ticket request and to the stream within the answer limit', () =>
    expectNotReadyInTime(app));
});

describe('the live routes while Redis keeps the connection and never answers', () => {
  let proxy: TcpProxy;
  let redis: RedisService;
  let app: NestExpressApplication;

  beforeAll(async () => {
    proxy = await startTcpProxy(await configuredRedisUrl());
    redis = redisAt(proxy.url);
    await once(redis.client, 'ready');
    proxy.silence();
    app = await startTestApp(appTestingModule().overrideProvider(RedisService).useValue(redis));
  });

  afterAll(async () => {
    redis.client.disconnect();
    await app.close();
    await proxy.close();
  });

  it('answer 503 to the ticket request and to the stream within the answer limit', () =>
    expectNotReadyInTime(app));
});
