import { createHash } from 'node:crypto';

import {
  authResponseSchema,
  DEFAULT_SEARCH_TITLE,
  errorResponseSchema,
  refreshTokenSchema,
  sessionTokensSchema,
} from '@jobflow/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { appTestingModule, useTestApp } from '../../test/app.js';
import {
  cacheControlOf,
  OLENA,
  refreshCookieOf,
  refreshTokenFromCookie,
  refreshWith,
  signIn,
} from '../../test/auth.js';
import { memoryLog, withLogSink } from '../../test/memory-log.js';

const REFRESH_COOKIE_ATTRIBUTES = {
  name: 'refresh_token',
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/api/v1/auth',
  maxAge: 2_592_000,
};

const log = memoryLog();

describe('register and login with email and password', () => {
  const testApp = useTestApp(() => withLogSink(appTestingModule(), log.sink));

  const http = () => request(testApp.app.getHttpServer());

  const register = (body: object) => http().post('/api/v1/auth/register').send(body);

  const login = (body: object) => http().post('/api/v1/auth/login').send(body);

  const outboxRows = () =>
    testApp.prisma.outboxEvent.findMany({
      select: { aggregate: true, aggregateId: true, eventType: true, payload: true },
    });

  it('registers a user with default settings and exactly one active search', async () => {
    const response = await register(OLENA);

    expect(response.status).toBe(201);
    const { user, accessToken } = authResponseSchema.parse(response.body);
    expect(user).toMatchObject({ email: OLENA.email, displayName: 'Олена', locale: 'uk' });
    expect(response.body).toEqual({ user, accessToken });
    const settings = await testApp.prisma.userSettings.findUnique({ where: { userId: user.id } });
    expect(settings?.silenceDays).toBe(7);
    const searches = await testApp.prisma.search.findMany({
      where: { userId: user.id, status: 'active' },
    });
    expect(searches.map((search) => search.title)).toEqual([DEFAULT_SEARCH_TITLE]);
    expect(DEFAULT_SEARCH_TITLE).toBe('Мій пошук');
  });

  it('writes one user.registered outbox row with the new user id on register', async () => {
    const { user } = authResponseSchema.parse((await register(OLENA)).body);

    expect(await outboxRows()).toEqual([
      {
        aggregate: 'user',
        aggregateId: user.id,
        eventType: 'user.registered',
        payload: { userId: user.id },
      },
    ]);
  });

  it('sets the refresh cookie HttpOnly, Secure, SameSite=Strict on the auth path for 30 days, with no-store', async () => {
    const registered = await register(OLENA);
    const loggedIn = await login({ email: OLENA.email, password: OLENA.password });

    const cookies = [refreshCookieOf(registered), refreshCookieOf(loggedIn)];
    expect(cookies).toMatchObject([REFRESH_COOKIE_ATTRIBUTES, REFRESH_COOKIE_ATTRIBUTES]);
    expect(cacheControlOf(registered, loggedIn)).toEqual(['no-store', 'no-store']);
    const values = cookies.map((cookie) => refreshTokenSchema.safeParse(cookie?.value).success);
    expect(values).toEqual([true, true]);
  });

  it('stores only the SHA-256 hex of the refresh token', async () => {
    const response = await register(OLENA);
    const refreshToken = refreshTokenFromCookie(response);

    const rows = await testApp.prisma.refreshToken.findMany({ select: { tokenHash: true } });

    expect(rows).toEqual([{ tokenHash: createHash('sha256').update(refreshToken).digest('hex') }]);
  });

  it('refuses an email that is already registered, in any case, with 409', async () => {
    await register(OLENA);

    const response = await register({ ...OLENA, email: 'OLENA@Example.TEST' });

    expect(response.status).toBe(409);
    expect(errorResponseSchema.parse(response.body)).toMatchObject({
      type: 'conflict',
      detail: 'Email is already registered',
    });
    expect(await testApp.prisma.user.count()).toBe(1);
    expect(await outboxRows()).toHaveLength(1);
  });

  it('refuses a password shorter than 10 characters with 422 on the password path', async () => {
    const response = await register({ ...OLENA, password: 'short-pw' });

    expect(response.status).toBe(422);
    const body = errorResponseSchema.parse(response.body);
    expect(body.errors?.map((error) => error.path)).toEqual(['password']);
    expect(JSON.stringify(body)).not.toContain('short-pw');
    expect(await testApp.prisma.user.count()).toBe(0);
  });

  it('signs a registered user in with 200, the same user and an access token', async () => {
    const registered = authResponseSchema.parse((await register(OLENA)).body);

    const response = await login({ email: OLENA.email, password: OLENA.password });

    expect(response.status).toBe(200);
    const signedIn = authResponseSchema.parse(response.body);
    expect(signedIn.user).toEqual(registered.user);
    expect(response.body).toEqual({ user: registered.user, accessToken: signedIn.accessToken });
  });

  it('answers a wrong password and an unknown email with the same generic 401', async () => {
    await register(OLENA);

    const wrongPassword = await login({ email: OLENA.email, password: 'not-the-password' });
    const unknownEmail = await login({ email: 'nobody@example.test', password: OLENA.password });

    const generic = { status: 401, type: 'unauthorized', detail: 'Invalid email or password' };
    const outcomes = [wrongPassword, unknownEmail].map((response) => {
      const { status, type, detail } = errorResponseSchema.parse(response.body);
      return { httpStatus: response.status, status, type, detail };
    });
    expect(outcomes).toEqual([
      { httpStatus: 401, ...generic },
      { httpStatus: 401, ...generic },
    ]);
  });

  it('writes the password to no log line on register, login, 422 or 401', async () => {
    log.lines.length = 0;

    await register(OLENA);
    await login({ email: OLENA.email, password: OLENA.password });
    await register({ email: 'not-an-email', password: OLENA.password });
    await login({ email: 'nobody@example.test', password: OLENA.password });

    expect(log.lines.length).toBeGreaterThan(0);
    const written = log.lines.join('\n');
    expect(written).not.toContain(OLENA.password);
    expect(written).not.toContain('nobody@example.test');
  });

  it('writes no access token, refresh token or cookie value to a log line', async () => {
    await register(OLENA);
    log.lines.length = 0;

    const web = await signIn(testApp.app, OLENA);
    const mobile = await signIn(testApp.app, { ...OLENA, mobile: true });
    const rotated = await refreshWith(testApp.app, web);
    const mobileRotated = await refreshWith(testApp.app, {
      refreshToken: mobile.refreshToken,
      mobile: true,
    });
    await refreshWith(testApp.app, web);
    await http().get('/api/v1/auth/me').set('authorization', `Bearer ${web.accessToken}x`);

    const mobileNext = sessionTokensSchema.parse(mobileRotated.body);
    const secrets = [
      web.accessToken,
      web.refreshToken,
      mobile.accessToken,
      mobile.refreshToken,
      sessionTokensSchema.parse(rotated.body).accessToken,
      refreshTokenFromCookie(rotated),
      mobileNext.accessToken,
      mobileNext.refreshToken ?? 'missing mobile refresh token',
    ];
    const written = log.lines.join('\n');
    expect(log.lines.length).toBeGreaterThan(0);
    expect(secrets.filter((secret) => written.includes(secret))).toEqual([]);
  });
});
