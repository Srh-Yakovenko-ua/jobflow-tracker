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
  clearedCookie,
  OLENA,
  refreshCookie,
  refreshCookieOf,
  refreshTokenFromCookie,
  refreshWith,
  setCookies,
  signIn,
  signUp,
} from '../../test/auth.js';
import { bookmarkletStatus, signedInWithCaptureToken } from '../../test/capture.js';
import { callRoute } from '../../test/http.js';
import { memoryLog, withLogSink } from '../../test/memory-log.js';
import { hashRefreshToken, REFRESH_REUSE_GRACE_MS } from './refresh-tokens.js';

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

  const revokedPastTheGrace = (token: string) =>
    testApp.prisma.refreshToken.update({
      where: { tokenHash: hashRefreshToken(token) },
      data: { revokedAt: new Date(Date.now() - REFRESH_REUSE_GRACE_MS - 1000) },
    });

  const refreshedFrom = async (refreshToken: string) => {
    const response = await refreshWith(testApp.app, { refreshToken });
    return { status: response.status, token: refreshTokenFromCookie(response) };
  };

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
    await revokedPastTheGrace(first);
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

  it('answers a rotated token presented again within 30 s with a new token of its family, and revokes the family once the grace is over', async () => {
    const { refreshToken: first } = await signUp(testApp.app, OLENA);
    const rotated = await refreshedFrom(first);
    const again = await refreshedFrom(first);
    const { familyId } = await storedToken(first);
    const fromRotated = await refreshedFrom(rotated.token);
    const fromAgain = await refreshedFrom(again.token);
    await revokedPastTheGrace(first);
    log.lines.length = 0;

    const late = await refreshWith(testApp.app, { refreshToken: first });

    expect([rotated.status, again.status, fromRotated.status, fromAgain.status]).toEqual([
      200, 200, 200, 200,
    ]);
    expect(await storedToken(again.token)).toMatchObject({ familyId });
    expect(late.status).toBe(401);
    expect((await familyRows(familyId)).every((row) => row.revokedAt instanceof Date)).toBe(true);
    expect((await refreshWith(testApp.app, { refreshToken: fromAgain.token })).status).toBe(401);
    expect(log.parsed().map(({ msg }) => msg)).toContain('refresh token reuse, family revoked');
  });

  it('answers a token revoked by logout within 30 s with 401 and no reuse warning', async () => {
    const { refreshToken } = await signUp(testApp.app, OLENA);
    await http().post('/api/v1/auth/logout').set('cookie', refreshCookie(refreshToken));
    log.lines.length = 0;

    const response = await refreshWith(testApp.app, { refreshToken });

    expect(response.status).toBe(401);
    expect(log.parsed().map(({ msg }) => msg)).not.toContain('refresh token reuse, family revoked');
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
    expect(refreshCookieOf(response)).toMatchObject(clearedCookie('/api/v1/auth'));
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

  it("ends the user's capture token on logout everywhere and leaves another user's working", async () => {
    const olena = await signedInWithCaptureToken(testApp);
    const bohdan = await signedInWithCaptureToken(testApp);
    expect(await bookmarkletStatus(testApp.app, olena.captureToken)).toBe(202);

    const response = await callRoute(testApp.app, {
      method: 'post',
      path: '/api/v1/auth/logout-all',
      accessToken: olena.accessToken,
    });

    expect(response.status).toBe(204);
    expect(await bookmarkletStatus(testApp.app, olena.captureToken)).toBe(401);
    expect(await bookmarkletStatus(testApp.app, bohdan.captureToken)).toBe(202);
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
