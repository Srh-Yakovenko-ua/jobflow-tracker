import {
  authResponseSchema,
  errorResponseSchema,
  refreshTokenSchema,
  sessionTokensSchema,
} from '@jobflow/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { appTestingModule, useTestApp } from '../../test/app.js';
import {
  BOHDAN,
  cacheControlOf,
  OLENA,
  refreshCookie,
  refreshCookieOf,
  refreshTokenFromCookie,
  refreshWith,
  setCookies,
  signIn,
  signUp,
} from '../../test/auth.js';
import { memoryLog, withLogSink } from '../../test/memory-log.js';
import { hashRefreshToken } from './refresh-tokens.js';

const log = memoryLog();

describe('refresh token rotation and revocation', () => {
  const testApp = useTestApp(() => withLogSink(appTestingModule(), log.sink));

  const http = () => request(testApp.app.getHttpServer());

  const storedToken = (token: string) =>
    testApp.prisma.refreshToken.findUniqueOrThrow({
      where: { tokenHash: hashRefreshToken(token) },
    });

  const familyRows = (familyId: string) =>
    testApp.prisma.refreshToken.findMany({ where: { familyId }, orderBy: { createdAt: 'asc' } });

  it('rotates the token: the old row is revoked and the new one joins the same family', async () => {
    const { refreshToken: first } = await signUp(testApp.app, OLENA);

    const response = await refreshWith(testApp.app, { refreshToken: first });

    expect(response.status).toBe(200);
    const { accessToken } = sessionTokensSchema.parse(response.body);
    expect(response.body).toEqual({ accessToken });
    const second = refreshTokenFromCookie(response);
    expect(second).not.toBe(first);
    const [old, next] = [await storedToken(first), await storedToken(second)];
    expect(old.revokedAt).toBeInstanceOf(Date);
    expect(next).toMatchObject({ familyId: old.familyId, userId: old.userId, revokedAt: null });
    const me = await http().get('/api/v1/auth/me').set('authorization', `Bearer ${accessToken}`);
    expect(me.status).toBe(200);
  });

  it('revokes the whole family when a rotated token comes back, and leaves other sign-ins alone', async () => {
    const { user, refreshToken: first } = await signUp(testApp.app, OLENA);
    const otherSession = await signIn(testApp.app, OLENA);
    const second = refreshTokenFromCookie(await refreshWith(testApp.app, { refreshToken: first }));
    log.lines.length = 0;

    const reuse = await refreshWith(testApp.app, { refreshToken: first });

    expect(reuse.status).toBe(401);
    expect(errorResponseSchema.parse(reuse.body)).toMatchObject({
      type: 'unauthorized',
      detail: 'Invalid refresh token',
    });
    const { familyId } = await storedToken(first);
    const warnings = log
      .parsed()
      .filter((line) => line.msg === 'refresh token reuse, family revoked');
    expect(warnings).toEqual([expect.objectContaining({ level: 40, userId: user.id, familyId })]);
    const family = await familyRows(familyId);
    expect(family.map((row) => row.revokedAt instanceof Date)).toEqual([true, true]);
    expect((await refreshWith(testApp.app, { refreshToken: second })).status).toBe(401);
    expect((await refreshWith(testApp.app, otherSession)).status).toBe(200);
  });

  it('refuses an expired refresh token with 401 and leaves its family untouched', async () => {
    const { refreshToken } = await signUp(testApp.app, OLENA);
    await testApp.prisma.refreshToken.update({
      where: { tokenHash: hashRefreshToken(refreshToken) },
      data: { expiresAt: new Date('2026-01-01T00:00:00.000Z') },
    });

    const response = await refreshWith(testApp.app, { refreshToken });

    expect(response.status).toBe(401);
    expect((await storedToken(refreshToken)).revokedAt).toBeNull();
  });

  it.each([
    { path: 'refresh', status: 200, revoked: [true, false] },
    { path: 'logout', status: 204, revoked: [true] },
  ])(
    'answers a web $path with the cookie and an empty JSON body with $status',
    async ({ path, status, revoked }) => {
      const { refreshToken } = await signUp(testApp.app, OLENA);

      const response = await http()
        .post(`/api/v1/auth/${path}`)
        .set('cookie', refreshCookie(refreshToken))
        .send({});

      expect(response.status).toBe(status);
      const { familyId } = await storedToken(refreshToken);
      const family = await familyRows(familyId);
      expect(family.map((row) => row.revokedAt instanceof Date)).toEqual(revoked);
    },
  );

  it.each([
    ['without a cookie', () => http().post('/api/v1/auth/refresh')],
    ['with an unknown token', () => refreshWith(testApp.app, { refreshToken: 'x'.repeat(43) })],
    [
      'from a mobile client with no token in the body',
      () => http().post('/api/v1/auth/refresh').set('x-client', 'mobile').send({}),
    ],
  ])('refuses a refresh %s with 401', async (_case, send) => {
    const response = await send();

    expect(response.status).toBe(401);
    expect(errorResponseSchema.parse(response.body).type).toBe('unauthorized');
  });

  it('logs out: 204, the cookie is cleared, the family is revoked and another sign-in still refreshes', async () => {
    const { refreshToken } = await signUp(testApp.app, OLENA);
    const otherSession = await signIn(testApp.app, OLENA);

    const response = await http()
      .post('/api/v1/auth/logout')
      .set('cookie', refreshCookie(refreshToken));

    expect(response.status).toBe(204);
    expect(refreshCookieOf(response)).toMatchObject({
      value: '',
      path: '/api/v1/auth',
      expires: new Date(0),
    });
    expect((await refreshWith(testApp.app, { refreshToken })).status).toBe(401);
    expect((await refreshWith(testApp.app, otherSession)).status).toBe(200);
  });

  it('answers a logout without a refresh token with 204', async () => {
    const response = await http().post('/api/v1/auth/logout');

    expect(response.status).toBe(204);
  });

  it("logs out everywhere: every family of the user is revoked, another user's stays", async () => {
    const first = await signUp(testApp.app, OLENA);
    await signIn(testApp.app, OLENA);
    const bohdan = await signUp(testApp.app, BOHDAN);

    const response = await http()
      .post('/api/v1/auth/logout-all')
      .set('authorization', `Bearer ${first.accessToken}`);

    expect(response.status).toBe(204);
    expect(refreshCookieOf(response)?.value).toBe('');
    const rows = await testApp.prisma.refreshToken.findMany({ where: { userId: first.user.id } });
    expect(rows.map((row) => row.revokedAt instanceof Date)).toEqual([true, true]);
    expect((await refreshWith(testApp.app, bohdan)).status).toBe(200);
  });

  it('refuses logout everywhere without an access token with 401', async () => {
    const response = await http().post('/api/v1/auth/logout-all');

    expect(response.status).toBe(401);
    expect(errorResponseSchema.parse(response.body).type).toBe('unauthorized');
  });

  it('hands a mobile client the refresh token in the body, no cookie and no-store, and rotates it from the body', async () => {
    await signUp(testApp.app, OLENA);

    const login = await http()
      .post('/api/v1/auth/login')
      .set('x-client', 'mobile')
      .send({ email: OLENA.email, password: OLENA.password });

    expect(login.status).toBe(200);
    expect(setCookies(login)).toEqual([]);
    const refreshToken = refreshTokenSchema.parse(
      authResponseSchema.parse(login.body).refreshToken,
    );
    const rotated = await refreshWith(testApp.app, { refreshToken, mobile: true });
    expect(rotated.status).toBe(200);
    expect(setCookies(rotated)).toEqual([]);
    expect(cacheControlOf(login, rotated)).toEqual(['no-store', 'no-store']);
    const next = sessionTokensSchema.parse(rotated.body).refreshToken;
    expect(next).toEqual(expect.schemaMatching(refreshTokenSchema));
    expect(next).not.toBe(refreshToken);
  });
});
