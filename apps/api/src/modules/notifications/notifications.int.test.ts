import { randomUUID } from 'node:crypto';

import {
  markNotificationsReadResponseSchema,
  type NotificationListResponse,
  notificationListResponseSchema,
} from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { Prisma } from '../../generated/prisma/client.js';
import { useTestApp } from '../../test/app.js';
import { getWithQuery, type QueryString } from '../../test/applications.js';
import { accessTokenFor } from '../../test/auth.js';
import { queuedBehindRowLock } from '../../test/database.js';
import { createUser } from '../../test/factories.js';
import { callRoute, errorPathsOf } from '../../test/http.js';
import {
  createNotifications,
  NOTIFICATIONS_PATH,
  NOTIFICATIONS_READ_PATH,
  SILENCE_PAYLOAD,
} from '../../test/notifications.js';
import { outboxRows } from '../../test/outbox.js';
import { NOW } from '../../test/time.js';
import { NotificationsService } from './notifications.service.js';

const AI_DONE = { aiJobId: randomUUID(), kind: 'vacancy_parse' } as const;

const UNLOCKED = { type: 'insight_unlocked', payload: { applications: 10 } } as const;

describe('the notification feed', () => {
  const testApp = useTestApp();

  const service = () => testApp.app.get(NotificationsService);

  async function signedIn() {
    const user = await createUser(testApp.prisma);
    return { userId: user.id, accessToken: await accessTokenFor(user) };
  }

  async function feedOf(accessToken: string, query: QueryString = {}) {
    const response = await getWithQuery(testApp.app, {
      path: NOTIFICATIONS_PATH,
      accessToken,
      query,
    });
    expect(response.status).toBe(200);
    return notificationListResponseSchema.parse(response.body);
  }

  const idsOf = ({ items }: NotificationListResponse) => items.map(({ id }) => id);

  const markRead = (accessToken: string, body: object) =>
    callRoute(testApp.app, { method: 'post', path: NOTIFICATIONS_READ_PATH, accessToken, body });

  const readAtOf = (ids: string[]) =>
    testApp.prisma.notification.findMany({
      where: { id: { in: ids } },
      orderBy: { id: 'asc' },
      select: { readAt: true },
    });

  async function olenaAndBohdan() {
    const [olena, bohdan] = [await signedIn(), await signedIn()];
    const ids = await createNotifications(testApp.prisma, {
      userId: olena.userId,
      readAt: [null, NOW, null],
    });
    const [foreign = ''] = await createNotifications(testApp.prisma, {
      userId: bohdan.userId,
      readAt: [null],
    });
    return { olena, bohdan, ids, foreign };
  }

  it.each([
    { unread: undefined, kept: [2, 1, 0] },
    { unread: 'true', kept: [2, 0] },
    { unread: 'false', kept: [1] },
  ])(
    "answers the user's notifications newest first for unread $unread and none of another user's",
    async ({ unread, kept }) => {
      const { olena, ids } = await olenaAndBohdan();

      const feed = await feedOf(olena.accessToken, unread === undefined ? {} : { unread });

      expect(idsOf(feed)).toEqual(kept.map((index) => ids[index]));
      expect(feed.items[0]).toMatchObject({ type: 'silence', payload: SILENCE_PAYLOAD });
    },
  );

  it('pages three notifications two at a time by the id cursor', async () => {
    const { userId, accessToken } = await signedIn();
    const [first, second, third] = await createNotifications(testApp.prisma, {
      userId,
      readAt: [null, null, null],
    });

    const page = await feedOf(accessToken, { limit: '2' });
    const last = await feedOf(accessToken, { limit: '2', cursor: page.nextCursor ?? '' });

    expect([idsOf(page), page.nextCursor]).toEqual([[third, second], second]);
    expect([idsOf(last), last.nextCursor]).toEqual([[first], null]);
  });

  it.each([
    { query: { cursor: 'x' }, path: 'cursor' },
    { query: { unread: 'maybe' }, path: 'unread' },
    { query: { limit: '101' }, path: 'limit' },
  ])('answers 422 at $path for the query $query', async ({ query, path }) => {
    const { accessToken } = await signedIn();

    const response = await getWithQuery(testApp.app, {
      path: NOTIFICATIONS_PATH,
      accessToken,
      query,
    });

    expect([response.status, errorPathsOf(response.body)]).toEqual([422, [path]]);
  });

  it.each([
    { method: 'get', path: NOTIFICATIONS_PATH },
    { method: 'post', path: NOTIFICATIONS_READ_PATH, body: { all: true } },
  ] as const)('answers 401 to $method $path without a token', async (call) => {
    const response = await callRoute(testApp.app, call);

    expect(response.status).toBe(401);
  });

  it("marks the given ids of the user read, leaves another user's id unread and answers the unread count", async () => {
    const { olena, ids, foreign } = await olenaAndBohdan();
    const [first = '', , third = ''] = ids;

    const response = await markRead(olena.accessToken, { ids: [first, foreign] });

    expect([response.status, markNotificationsReadResponseSchema.parse(response.body)]).toEqual([
      200,
      { unread: 1 },
    ]);
    expect((await readAtOf([third, foreign])).map(({ readAt }) => readAt)).toEqual([null, null]);
    expect((await readAtOf([first]))[0]?.readAt).toBeInstanceOf(Date);
  });

  it("marks every unread notification of the user with all and leaves another user's", async () => {
    const { olena, bohdan } = await olenaAndBohdan();

    const response = await markRead(olena.accessToken, { all: true });

    expect([response.status, response.body]).toEqual([200, { unread: 0 }]);
    expect(await feedOf(bohdan.accessToken, { unread: 'true' })).toMatchObject({
      items: [expect.anything()],
    });
  });

  it.each([
    { case: 'no ids', ids: [] },
    { case: '101 ids', ids: Array.from({ length: 101 }, () => randomUUID()) },
  ])('answers 422 to a read of $case', async ({ ids }) => {
    const { accessToken } = await signedIn();

    const response = await markRead(accessToken, { ids });

    expect(response.status).toBe(422);
  });

  it('writes the notification and its notification.created outbox row in one transaction', async () => {
    const { userId } = await signedIn();

    await service().record(userId, { type: 'silence', payload: SILENCE_PAYLOAD });

    const [stored] = await testApp.prisma.notification.findMany({ where: { userId } });
    expect(await outboxRows(testApp.prisma, { aggregate: 'notification' })).toEqual([
      {
        aggregate: 'notification',
        aggregateId: stored?.id,
        eventType: 'notification.created',
        payload: { userId, notificationId: stored?.id, type: 'silence' },
      },
    ]);
  });

  it('leaves neither the notification nor its outbox row when the transaction fails', async () => {
    const { userId } = await signedIn();

    const failing = testApp.prisma.$transaction(async (tx) => {
      await service().record(userId, { type: 'silence', payload: SILENCE_PAYLOAD, tx });
      throw new Error('the caller failed');
    });

    await expect(failing).rejects.toThrow('the caller failed');
    expect([
      await testApp.prisma.notification.count({ where: { userId } }),
      await testApp.prisma.outboxEvent.count({ where: { aggregate: 'notification' } }),
    ]).toEqual([0, 0]);
  });

  it('makes a second insight_unlocked write wait on the user lock and keeps one row, and one of another user', async () => {
    const [olena, bohdan] = [await signedIn(), await signedIn()];
    const write = () => service().recordOnce(olena.userId, UNLOCKED);

    await queuedBehindRowLock(testApp.prisma, {
      lock: Prisma.sql`SELECT 1 FROM users WHERE id = ${olena.userId}::uuid FOR UPDATE`,
      calls: [write, write],
    });
    await service().recordOnce(bohdan.userId, UNLOCKED);

    const owners = await testApp.prisma.notification.findMany({ select: { userId: true } });
    expect(owners.map(({ userId }) => userId).sort()).toEqual([olena.userId, bohdan.userId].sort());
  });

  it('writes ai_done once per AI job and once more for another job', async () => {
    const { userId } = await signedIn();
    const other = { ...AI_DONE, aiJobId: randomUUID() };

    await service().recordOnce(userId, { type: 'ai_done', payload: AI_DONE });
    await service().recordOnce(userId, { type: 'ai_done', payload: AI_DONE });
    await service().recordOnce(userId, { type: 'ai_done', payload: other });

    const rows = await testApp.prisma.notification.findMany({
      where: { userId },
      orderBy: { id: 'asc' },
      select: { payload: true },
    });
    expect(rows).toEqual([{ payload: AI_DONE }, { payload: other }]);
  });
});
