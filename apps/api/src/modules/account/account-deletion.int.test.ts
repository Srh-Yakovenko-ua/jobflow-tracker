import { ConfigService } from '@nestjs/config';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { AppConfig } from '../../config/app-config.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { FileStorage } from '../../storage/file-storage.js';
import { postExport } from '../../test/account.js';
import {
  appTestingModule,
  rateLimitedTestingModule,
  type TestApp,
  useTestApp,
} from '../../test/app.js';
import {
  applicationPath,
  createApplication,
  postStageMove,
  ROMASHKA,
  signedInWithSearch,
} from '../../test/applications.js';
import {
  BOHDAN,
  clearedCookie,
  OLENA,
  refreshCookieOf,
  refreshWith,
  signUp,
  type SignUpInput,
} from '../../test/auth.js';
import { issueCaptureToken } from '../../test/capture.js';
import { createNotes, createScheduledEvent, randomEmail } from '../../test/factories.js';
import {
  DownFileStorage,
  ExportsPurgeDownFileStorage,
  FakeFileStorage,
} from '../../test/file-storage.js';
import { callRoute, errorPathsOf, statusAndType } from '../../test/http.js';
import { fillUserOwnedTables } from '../../test/owned-rows.js';
import { expectRateLimited, randomClientIp } from '../../test/rate-limit.js';
import { TO_SCREENING } from '../../test/service-fixtures.js';
import { NOW } from '../../test/time.js';

const ME_PATH = '/api/v1/me';

const USER_ID_TABLES = [
  'ai_calls',
  'ai_jobs',
  'ai_results',
  'applications',
  'capture_tokens',
  'idempotency_keys',
  'notifications',
  'oauth_accounts',
  'plans',
  'push_subscriptions',
  'refresh_tokens',
  'reminders',
  'resume_versions',
  'resumes',
  'searches',
  'user_settings',
];

const APPLICATION_ID_TABLES = [
  'ai_jobs',
  'contacts',
  'notes',
  'reminders',
  'scheduled_events',
  'stage_events',
  'timeline_events',
];

type OwnerColumn = { column: 'user_id' | 'application_id' | 'plan_id'; ids: string[] };

async function rowCountsBy(prisma: PrismaService, { column, ids }: OwnerColumn) {
  const tables = await prisma.$queryRaw<{ name: string }[]>`
    SELECT table_name::text AS name FROM information_schema.columns
    WHERE table_schema = current_schema() AND column_name = ${column}
    ORDER BY table_name`;
  const counts = await Promise.all(
    tables.map(async ({ name }) => {
      const [row] = await prisma.$queryRaw<{ count: number }[]>`
        SELECT count(*)::int AS count FROM ${Prisma.raw(`"${name}"`)}
        WHERE ${Prisma.raw(`"${column}"`)} = ANY(${ids}::uuid[])`;
      return [name, row?.count ?? 0] as const;
    }),
  );
  return Object.fromEntries(counts);
}

const everyCountIn = (counts: Record<string, number>) => [...new Set(Object.values(counts))];

const outboxOf = (prisma: PrismaService, userId: string) =>
  prisma.outboxEvent.count({
    where: { OR: [{ payload: { path: ['userId'], equals: userId } }, { aggregateId: userId }] },
  });

describe('DELETE /me', () => {
  const storage = new FakeFileStorage();
  const testApp: TestApp = useTestApp(() =>
    appTestingModule().overrideProvider(FileStorage).useValue(storage),
  );

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const deleteAccount = (accessToken: string | undefined, password: string) =>
    callRoute(testApp.app, { method: 'delete', path: ME_PATH, accessToken, body: { password } });

  async function signedUpWithEverything(user: SignUpInput) {
    const { app, prisma } = testApp;
    const signedIn = await signUp(app, user);
    const { accessToken } = signedIn;
    const userId = signedIn.user.id;
    const { id: applicationId, searchId } = await createApplication(app, {
      accessToken,
      input: ROMASHKA,
    });
    await postStageMove(app, { accessToken, id: applicationId, input: TO_SCREENING });
    await fillUserOwnedTables(prisma, { userId, searchId, applicationId });
    await createNotes(prisma, [{ applicationId, body: 'Нотатка' }]);
    await prisma.contact.create({ data: { applicationId, name: 'Ірина' } });
    await prisma.timelineEvent.create({ data: { applicationId, kind: 'note_added' } });
    await createScheduledEvent(prisma, { applicationId, kind: 'tech_interview', startsAt: NOW });
    await issueCaptureToken(app, accessToken);
    await prisma.oAuthAccount.create({
      data: { userId, provider: 'github', providerUserId: userId },
    });
    await postExport(app, { accessToken, format: 'csv' });
    for (const key of [
      `users/${userId}/resumes/cv.pdf`,
      `pending/users/${userId}/resumes/next.pdf`,
    ]) {
      await storage.put({ key, bytes: new Uint8Array([37, 80, 68, 70]), mime: 'application/pdf' });
    }
    return { ...signedIn, userId, applicationId };
  }

  async function confirmedByEmail(
    { userId, accessToken }: { userId: string; accessToken: string },
    email: string,
  ) {
    await testApp.prisma.user.update({ where: { id: userId }, data: { passwordHash: null } });
    const response = await deleteAccount(accessToken, email);
    return [response.status, await testApp.prisma.user.count({ where: { id: userId } })];
  }

  async function ownedCounts(userId: string, applicationIds: string[]) {
    const plans = await testApp.prisma.plan.findMany({ where: { userId }, select: { id: true } });
    return {
      byUser: await rowCountsBy(testApp.prisma, { column: 'user_id', ids: [userId] }),
      byApplication: await rowCountsBy(testApp.prisma, {
        column: 'application_id',
        ids: applicationIds,
      }),
      planItems: await rowCountsBy(testApp.prisma, {
        column: 'plan_id',
        ids: plans.map(({ id }) => id),
      }),
      users: await testApp.prisma.user.count({ where: { id: userId } }),
      outbox: await outboxOf(testApp.prisma, userId),
      files: [
        ...storage.keysUnder(`users/${userId}/`),
        ...storage.keysUnder(`pending/users/${userId}/`),
      ],
    };
  }

  it('deletes every row with the user id, its application rows, its outbox events and its files, and keeps another user whole', async () => {
    const olena = await signedUpWithEverything(OLENA);
    const bohdan = await signedUpWithEverything(BOHDAN);
    const before = await ownedCounts(olena.userId, [olena.applicationId]);
    const bohdanBefore = await ownedCounts(bohdan.userId, [bohdan.applicationId]);
    expect(Object.keys(before.byUser)).toEqual(USER_ID_TABLES);
    expect(Object.keys(before.byApplication)).toEqual(APPLICATION_ID_TABLES);
    expect(everyCountIn(before.byUser).includes(0)).toBe(false);
    expect(everyCountIn(before.byApplication).includes(0)).toBe(false);
    expect(everyCountIn(before.planItems)).toEqual([1]);
    expect([before.users, before.outbox > 0, before.files.length]).toEqual([1, true, 2]);

    const response = await deleteAccount(olena.accessToken, OLENA.password);

    expect(response.status).toBe(204);
    expect(refreshCookieOf(response)).toMatchObject(clearedCookie('/api/v1/auth'));
    const after = await ownedCounts(olena.userId, [olena.applicationId]);
    expect(everyCountIn(after.byUser)).toEqual([0]);
    expect(everyCountIn(after.byApplication)).toEqual([0]);
    expect(everyCountIn(after.planItems)).toEqual([0]);
    expect([after.users, after.outbox, after.files]).toEqual([0, 0, []]);
    expect((await refreshWith(testApp.app, { refreshToken: olena.refreshToken })).status).toBe(401);
    expect(
      statusAndType(
        await callRoute(testApp.app, {
          method: 'get',
          path: applicationPath(olena.applicationId),
          accessToken: olena.accessToken,
        }),
      ),
    ).toEqual([404, 'not_found']);
    expect(await ownedCounts(bohdan.userId, [bohdan.applicationId])).toEqual(bohdanBefore);
  });

  it('answers 422 on path password to a wrong password and keeps the account and its files', async () => {
    const olena = await signedUpWithEverything(OLENA);

    const response = await deleteAccount(olena.accessToken, 'not my password');

    expect([response.status, errorPathsOf(response.body)]).toEqual([422, ['password']]);
    const after = await ownedCounts(olena.userId, [olena.applicationId]);
    expect([after.users, after.files.length]).toEqual([1, 2]);
  });

  it('confirms an account without a password by its own email', async () => {
    const olena = await signedUpWithEverything(OLENA);

    expect(await confirmedByEmail(olena, OLENA.email.toUpperCase())).toEqual([204, 0]);
  });

  it('an OAuth email of 200 characters confirms the deletion', async () => {
    const email = `${'o'.repeat(64)}@${'d'.repeat(63)}.${'e'.repeat(58)}.jobflow.test`;
    const { user, accessToken } = await signUp(testApp.app, { ...OLENA, email });

    expect([
      email.length,
      ...(await confirmedByEmail({ userId: user.id, accessToken }, email)),
    ]).toEqual([200, 204, 0]);
  });

  it('answers 503 when the file storage is down and keeps the account whole', async () => {
    const olena = await signedUpWithEverything(OLENA);
    vi.spyOn(storage, 'deletePrefix').mockImplementationOnce(() =>
      new DownFileStorage().deletePrefix(),
    );

    const response = await deleteAccount(olena.accessToken, OLENA.password);

    expect(statusAndType(response)).toEqual([503, 'not_ready']);
    const after = await ownedCounts(olena.userId, [olena.applicationId]);
    expect([after.users, after.outbox > 0, after.files.length]).toEqual([1, true, 2]);
  });

  it('a deletion whose export purge fails answers 204 and clears the cookie', async () => {
    const olena = await signedUpWithEverything(OLENA);
    const exportsDown = new ExportsPurgeDownFileStorage();
    vi.spyOn(storage, 'deletePrefix').mockImplementation((prefix) =>
      exportsDown.deletePrefix(prefix),
    );

    const response = await deleteAccount(olena.accessToken, OLENA.password);

    expect(response.status).toBe(204);
    expect(refreshCookieOf(response)).toMatchObject(clearedCookie('/api/v1/auth'));
    expect(await testApp.prisma.user.count({ where: { id: olena.userId } })).toBe(0);
  });

  it('answers 401 without a token', async () => {
    expect((await deleteAccount(undefined, OLENA.password)).status).toBe(401);
  });
});

describe('DELETE /me under the login rate limit', () => {
  const testApp = useTestApp(() => rateLimitedTestingModule());

  beforeAll(() => {
    testApp.app.set('trust proxy', 'loopback');
  });

  it('answers 429 to the guess past the login limit of one user, however each guess changes its email and IP', async () => {
    const olena = await signedInWithSearch(testApp.prisma);
    const limit = testApp.app
      .get<AppConfig>(ConfigService)
      .get('RATE_LIMIT_LOGIN_PER_MINUTE', { infer: true });
    const guess = () =>
      callRoute(testApp.app, {
        method: 'delete',
        path: ME_PATH,
        accessToken: olena.accessToken,
        body: { password: 'guess', email: randomEmail() },
        headers: { 'x-forwarded-for': randomClientIp() },
      });

    const allowed = await Promise.all(Array.from({ length: limit }, guess));

    expect(allowed.map(({ status }) => status)).toEqual([422, 422, 422, 422, 422]);
    expectRateLimited(await guess(), { windowSeconds: 60 });
    expect(await testApp.prisma.user.count({ where: { id: olena.userId } })).toBe(1);
  });
});
