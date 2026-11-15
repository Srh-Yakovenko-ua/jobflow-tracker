import { PUSH_LIMITS, pushPublicKeySchema, pushSubscriptionCreatedSchema } from '@jobflow/shared';
import { getQueueToken } from '@nestjs/bullmq';
import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { Clock } from '../../common/clock.js';
import { DomainEventRouter } from '../../outbox/domain-event-router.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { useTestApp } from '../../test/app.js';
import { accessTokenFor } from '../../test/auth.js';
import { createUser } from '../../test/factories.js';
import { callRoute, errorPathsOf } from '../../test/http.js';
import { memoryLog } from '../../test/memory-log.js';
import { SILENCE_PAYLOAD } from '../../test/notifications.js';
import { outboxRows } from '../../test/outbox.js';
import { processedJob } from '../../test/processed-job.js';
import { compileProcessorModule } from '../../test/processor.js';
import {
  CHROME_SUBSCRIPTION,
  PUSH_PUBLIC_KEY_PATH,
  PUSH_SUBSCRIPTIONS_PATH,
  pushSubscriptionPath,
  ScriptedPushSender,
  SILENCE_PUSH,
} from '../../test/push.js';
import { MISSING_ID } from '../../test/service-fixtures.js';
import { StubQueue } from '../../test/stub-queues.js';
import { fixedClock, NOW } from '../../test/time.js';
import { NotificationsService } from '../notifications/index.js';
import { SettingsService } from '../settings/index.js';
import { PushProcessor } from './push.processor.js';
import { PushRepository } from './push.repository.js';
import { PushSubscriber } from './push.subscriber.js';
import { PushDeliveryService } from './push-delivery.service.js';
import { PushSendService } from './push-send.service.js';
import { PushSender } from './push-sender.js';

const BOHDAN_SUBSCRIPTION = {
  ...CHROME_SUBSCRIPTION,
  endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/bohdan-firefox',
};

const STORED_SUBSCRIPTION = {
  endpoint: true,
  p256dh: true,
  auth: true,
  userAgent: true,
  userId: true,
  failedCount: true,
  lastSuccessAt: true,
} as const;

const log = memoryLog();

describe('push subscriptions', () => {
  const testApp = useTestApp();

  async function signedIn() {
    const user = await createUser(testApp.prisma);
    return { userId: user.id, accessToken: await accessTokenFor(user) };
  }

  const subscribe = (accessToken: string, body: object = CHROME_SUBSCRIPTION) =>
    callRoute(testApp.app, {
      method: 'post',
      path: PUSH_SUBSCRIPTIONS_PATH,
      accessToken,
      body,
      headers: { 'user-agent': 'Chrome/142 on Linux' },
    });

  const storedSubscriptions = () =>
    testApp.prisma.pushSubscription.findMany({ select: STORED_SUBSCRIPTION });

  it.each([
    { method: 'get', path: PUSH_PUBLIC_KEY_PATH },
    { method: 'post', path: PUSH_SUBSCRIPTIONS_PATH, body: CHROME_SUBSCRIPTION },
    { method: 'delete', path: pushSubscriptionPath(MISSING_ID) },
  ] as const)('answers 401 to $method $path without a token', async (call) => {
    expect((await callRoute(testApp.app, call)).status).toBe(401);
  });

  it('answers a null public key while the API has no VAPID keys', async () => {
    const { accessToken } = await signedIn();

    const response = await callRoute(testApp.app, {
      method: 'get',
      path: PUSH_PUBLIC_KEY_PATH,
      accessToken,
    });

    expect([response.status, pushPublicKeySchema.parse(response.body)]).toEqual([
      200,
      { publicKey: null },
    ]);
  });

  it('saves the subscription with the user agent and keeps one row when the browser sends it again', async () => {
    const { userId, accessToken } = await signedIn();

    const first = await subscribe(accessToken);
    await testApp.prisma.pushSubscription.updateMany({ data: { failedCount: 2 } });
    const renewed = { ...CHROME_SUBSCRIPTION, keys: { p256dh: 'BRenewedKey', auth: 'renewed' } };
    const again = await subscribe(accessToken, renewed);

    expect([first.status, again.status]).toEqual([201, 201]);
    expect(pushSubscriptionCreatedSchema.parse(again.body)).toEqual(first.body);
    expect(await storedSubscriptions()).toEqual([
      {
        endpoint: CHROME_SUBSCRIPTION.endpoint,
        ...renewed.keys,
        userAgent: 'Chrome/142 on Linux',
        userId,
        failedCount: 0,
        lastSuccessAt: null,
      },
    ]);
  });

  it('gives an endpoint to the account signed in on that browser last', async () => {
    const olena = await signedIn();
    const bohdan = await signedIn();

    await subscribe(olena.accessToken);
    await subscribe(bohdan.accessToken);

    const owners = await testApp.prisma.pushSubscription.findMany({ select: { userId: true } });
    expect(owners).toEqual([{ userId: bohdan.userId }]);
  });

  it('an eleventh subscription replaces the oldest', async () => {
    const [olena, bohdan] = [await signedIn(), await signedIn()];
    await subscribe(bohdan.accessToken, BOHDAN_SUBSCRIPTION);
    const endpoints = Array.from(
      { length: PUSH_LIMITS.subscriptionsPerUser + 1 },
      (_, index) => `${CHROME_SUBSCRIPTION.endpoint}-${String(index + 1)}`,
    );
    for (const endpoint of endpoints) {
      await subscribe(olena.accessToken, { ...CHROME_SUBSCRIPTION, endpoint });
    }

    const kept = await testApp.prisma.pushSubscription.findMany({
      where: { userId: olena.userId },
      select: { endpoint: true },
      orderBy: { createdAt: 'asc' },
    });
    expect(kept.map(({ endpoint }) => endpoint)).toEqual(endpoints.slice(1));
    expect(await testApp.prisma.pushSubscription.count({ where: { userId: bohdan.userId } })).toBe(
      1,
    );
  });

  it.each([
    { case: 'an http endpoint', endpoint: 'http://fcm.googleapis.com/fcm/send/x' },
    { case: 'an internal host', endpoint: 'https://redis.internal/fcm/send/x' },
  ])('answers 422 at endpoint for $case and saves nothing', async ({ endpoint }) => {
    const { accessToken } = await signedIn();

    const response = await subscribe(accessToken, { ...CHROME_SUBSCRIPTION, endpoint });

    expect([response.status, errorPathsOf(response.body)]).toEqual([422, ['endpoint']]);
    expect(await storedSubscriptions()).toEqual([]);
  });

  it('deletes the subscription with 204 and answers 404 to a second delete', async () => {
    const { accessToken } = await signedIn();
    const { id } = pushSubscriptionCreatedSchema.parse((await subscribe(accessToken)).body);
    const remove = () =>
      callRoute(testApp.app, { method: 'delete', path: pushSubscriptionPath(id), accessToken });

    expect((await remove()).status).toBe(204);
    expect((await remove()).status).toBe(404);
    expect(await storedSubscriptions()).toEqual([]);
  });

  it('answers 422 at id to a delete of an id that is not a uuid', async () => {
    const { accessToken } = await signedIn();

    const response = await callRoute(testApp.app, {
      method: 'delete',
      path: pushSubscriptionPath('not-a-uuid'),
      accessToken,
    });

    expect([response.status, errorPathsOf(response.body)]).toEqual([422, ['id']]);
  });

  describe('delivery through the worker', () => {
    const sender = new ScriptedPushSender();
    const queue = new StubQueue('push');
    let worker: TestingModule;

    beforeAll(async () => {
      const settings = testApp.app.get<SettingsService>(SettingsService);
      const notifications = testApp.app.get<NotificationsService>(NotificationsService);
      worker = await compileProcessorModule(log.sink, [
        DomainEventRouter,
        PushSubscriber,
        PushDeliveryService,
        PushSendService,
        PushProcessor,
        PushRepository,
        { provide: PushSender, useValue: sender },
        { provide: Clock, useValue: fixedClock(NOW) },
        { provide: PrismaService, useValue: testApp.prisma },
        { provide: SettingsService, useValue: settings },
        { provide: NotificationsService, useValue: notifications },
        { provide: getQueueToken('push'), useValue: queue },
      ]);
      await worker.init();
    });

    afterAll(() => worker.close());

    beforeEach(() => {
      sender.sent.length = 0;
      sender.answer = 'sent';
      queue.jobs.length = 0;
    });

    async function pushSilenceTo(userId: string): Promise<void> {
      await testApp.app.get(SettingsService).update(userId, { notifyPush: true });
      await testApp.app.get(NotificationsService).record(userId, {
        type: 'silence',
        payload: SILENCE_PAYLOAD,
      });
      const [event] = await outboxRows(testApp.prisma, { aggregate: 'notification' });
      if (event === undefined) throw new Error('no notification.created row');
      const events = worker.get(DomainEventRouter);
      await events.route({ id: MISSING_ID, type: event.eventType, payload: event.payload });
      for (const { id, name, data } of queue.jobs) {
        await worker
          .get(PushProcessor)
          .process(processedJob({ queueName: 'push', name, data, id }));
      }
    }

    async function subscribedPair() {
      const [olena, bohdan] = [await signedIn(), await signedIn()];
      await subscribe(olena.accessToken);
      await subscribe(bohdan.accessToken, BOHDAN_SUBSCRIPTION);
      return { olena, bohdan };
    }

    const subscriptionOf = (userId: string) =>
      testApp.prisma.pushSubscription.findMany({
        where: { userId },
        select: { failedCount: true, lastSuccessAt: true },
      });

    it("sends a silence reminder to the user's browser only, opening the follow-up, and marks it delivered", async () => {
      const { olena, bohdan } = await subscribedPair();

      await pushSilenceTo(olena.userId);

      expect(sender.sent).toEqual([
        {
          target: { endpoint: CHROME_SUBSCRIPTION.endpoint, keys: CHROME_SUBSCRIPTION.keys },
          message: SILENCE_PUSH,
        },
      ]);
      expect(await subscriptionOf(olena.userId)).toEqual([{ failedCount: 0, lastSuccessAt: NOW }]);
      expect(await subscriptionOf(bohdan.userId)).toEqual([
        { failedCount: 0, lastSuccessAt: null },
      ]);
    });

    it('deletes a subscription after the first gone answer, a 404 or a 410 from the push service', async () => {
      const { olena, bohdan } = await subscribedPair();
      sender.answer = 'gone';

      await pushSilenceTo(olena.userId);

      expect(sender.sent).toHaveLength(1);
      expect(await subscriptionOf(olena.userId)).toEqual([]);
      expect(await subscriptionOf(bohdan.userId)).toHaveLength(1);
    });

    it('keeps a subscription the push service failed on and counts the failure', async () => {
      const { olena } = await subscribedPair();
      sender.answer = 'failed';

      await pushSilenceTo(olena.userId);

      expect(await subscriptionOf(olena.userId)).toEqual([{ failedCount: 1, lastSuccessAt: null }]);
    });

    it('queues nothing while the user keeps push turned off', async () => {
      const { olena } = await subscribedPair();
      await testApp.app.get(NotificationsService).record(olena.userId, {
        type: 'silence',
        payload: SILENCE_PAYLOAD,
      });
      const [event] = await outboxRows(testApp.prisma, { aggregate: 'notification' });

      await worker.get(DomainEventRouter).route({
        id: MISSING_ID,
        type: 'notification.created',
        payload: event?.payload,
      });

      expect([queue.jobs, sender.sent]).toEqual([[], []]);
    });
  });
});
