import { randomUUID } from 'node:crypto';

import { LIVE_EVENTS, type LiveEvent, liveEventSchema, liveTicketSchema } from '@jobflow/shared';
import type { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { vi } from 'vitest';

import { type AppConfig, configModule } from '../config/app-config.js';
import { validateEnv } from '../config/env.js';
import type { User } from '../generated/prisma/client.js';
import { type LiveEventBody, LiveHub, LivePublisher } from '../modules/live/index.js';
import { RedisService } from '../redis/redis.service.js';
import { accessTokenFor } from './auth.js';
import { exampleEnv } from './example-env.js';
import { callRoute } from './http.js';
import { listeningUrlOf, openSse, type SseFrame, type SseStream } from './sse.js';

export type PublishedLiveEvent = { userId: string; event: LiveEventBody };

export const LIVE_PATHS = {
  ticket: '/api/v1/events/ticket',
  stream: '/api/v1/events/stream',
} as const;

export class RecordingLivePublisher {
  readonly published: PublishedLiveEvent[] = [];

  publish(userId: string, event: LiveEventBody): Promise<void> {
    this.published.push({ userId, event });
    return Promise.resolve();
  }
}

export function redisAt(url: string): RedisService {
  return new RedisService(new ConfigService(validateEnv({ ...exampleEnv, REDIS_URL: url })));
}

export async function configuredRedisUrl(): Promise<string> {
  const moduleRef = await Test.createTestingModule({ imports: [configModule] }).compile();
  return moduleRef.get<AppConfig>(ConfigService).get('REDIS_URL', { infer: true });
}

export const streamPathOf = (ticket: string) =>
  `${LIVE_PATHS.stream}?ticket=${encodeURIComponent(ticket)}`;

export async function issueLiveTicket(app: NestExpressApplication, user: Pick<User, 'id'>) {
  const accessToken = await accessTokenFor(user);
  const response = await callRoute(app, { method: 'post', path: LIVE_PATHS.ticket, accessToken });
  return liveTicketSchema.parse(response.body);
}

export async function openLiveStream(
  app: NestExpressApplication,
  user: Pick<User, 'id'>,
): Promise<SseStream> {
  await listeningUrlOf(app);
  const { ticket } = await issueLiveTicket(app, user);
  return openSse(app, { path: streamPathOf(ticket) });
}

export function liveEventsOf(frames: SseFrame[]): LiveEvent[] {
  return frames
    .filter(({ event }) => event !== undefined)
    .map(({ id, event, data = 'null' }) =>
      liveEventSchema.parse({ id, type: event, data: JSON.parse(data) as unknown }),
    );
}

export async function liveHubSubscribed(app: INestApplicationContext): Promise<void> {
  const userId = randomUUID();
  let received = 0;
  const subscription = app
    .get(LiveHub)
    .stream(userId)
    .subscribe(() => {
      received += 1;
    });
  const probe = { type: LIVE_EVENTS.notificationCreated, data: { notificationId: userId } };
  await vi.waitFor(async () => {
    await app.get(LivePublisher).publish(userId, probe);
    if (received === 0) throw new Error('the live hub has not subscribed yet');
  });
  subscription.unsubscribe();
}
