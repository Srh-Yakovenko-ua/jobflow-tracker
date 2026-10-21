import { errorResponseSchema, meResponseSchema } from '@jobflow/shared';
import { calculateJwkThumbprint, createLocalJWKSet, jwtVerify } from 'jose';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { useTestApp } from '../../test/app.js';
import {
  accessTokenFor,
  BOHDAN,
  cacheControlOf,
  jwksResponseSchema,
  OLENA,
  refreshCookie,
  refreshWith,
  signIn,
  signUp,
} from '../../test/auth.js';

const NEW_PASSWORD = 'olena-password-2';

const LONG_AGO = new Date('2026-01-01T00:00:00.000Z');

describe('the signed-in account', () => {
  const testApp = useTestApp();

  const http = () => request(testApp.app.getHttpServer());

  const me = (accessToken: string) =>
    http().get('/api/v1/auth/me').set('authorization', `Bearer ${accessToken}`);

  const changePassword = (accessToken: string, body: object) =>
    http()
      .post('/api/v1/auth/change-password')
      .set('authorization', `Bearer ${accessToken}`)
      .send(body);

  it('answers GET /auth/me with the user and the settings a new user starts with', async () => {
    const { user, accessToken } = await signUp(testApp.app, OLENA);

    const response = await me(accessToken);

    expect(response.status).toBe(200);
    expect(meResponseSchema.parse(response.body)).toMatchObject({
      user,
      settings: { silenceDays: 7, quietHoursStart: '22:00', theme: 'system' },
    });
    expect(cacheControlOf(response)).toEqual(['no-store']);
  });

  it.each([
    {
      case: 'without an access token',
      header: undefined,
      detail: 'Missing access token',
      challenge: 'Bearer',
    },
    {
      case: 'with a garbage access token',
      header: 'Bearer garbage',
      detail: 'Invalid access token',
      challenge: 'Bearer error="invalid_token"',
    },
    {
      case: 'with another scheme',
      header: 'Basic b2xlbmE6c2VjcmV0',
      detail: 'Missing access token',
      challenge: 'Bearer',
    },
  ])(
    'refuses GET /auth/me $case with 401 unauthorized and the $challenge challenge',
    async ({ header, detail, challenge }) => {
      const call = http().get('/api/v1/auth/me');

      const response = await (header === undefined ? call : call.set('authorization', header));

      expect(response.status).toBe(401);
      expect(errorResponseSchema.parse(response.body)).toMatchObject({
        type: 'unauthorized',
        detail,
      });
      expect(response.get('www-authenticate')).toBe(challenge);
    },
  );

  it('refuses an expired access token with 401 token_expired and the request id', async () => {
    const { user } = await signUp(testApp.app, OLENA);

    const response = await me(await accessTokenFor(user, { issuedAt: LONG_AGO }));

    expect(response.status).toBe(401);
    const body = errorResponseSchema.parse(response.body);
    expect(body).toMatchObject({ status: 401, type: 'token_expired', title: 'Token expired' });
    expect(body.requestId).toBe(response.headers['x-request-id']);
    expect(response.get('www-authenticate')).toBe('Bearer error="invalid_token"');
  });

  it('refuses a valid token for a user that no longer exists with 401', async () => {
    const response = await me(await accessTokenFor({ id: crypto.randomUUID() }));

    expect(response.status).toBe(401);
  });

  it('refuses a wrong current password with 422 on currentPassword and keeps the old one', async () => {
    const { accessToken } = await signUp(testApp.app, OLENA);

    const response = await changePassword(accessToken, {
      currentPassword: 'not-the-password',
      newPassword: NEW_PASSWORD,
    });

    expect(response.status).toBe(422);
    const body = errorResponseSchema.parse(response.body);
    expect(body.errors?.map((error) => error.path)).toEqual(['currentPassword']);
    expect((await signIn(testApp.app, OLENA)).user.email).toBe(OLENA.email);
  });

  it('refuses a password change without an access token with 401', async () => {
    const response = await http()
      .post('/api/v1/auth/change-password')
      .send({ currentPassword: OLENA.password, newPassword: NEW_PASSWORD });

    expect(response.status).toBe(401);
  });

  it('changes the password with 204, keeps the current session and revokes every other one', async () => {
    const current = await signUp(testApp.app, OLENA);
    const other = await signIn(testApp.app, OLENA);

    const response = await changePassword(current.accessToken, {
      currentPassword: OLENA.password,
      newPassword: NEW_PASSWORD,
    }).set('cookie', refreshCookie(current.refreshToken));

    expect(response.status).toBe(204);
    const login = (password: string) =>
      http().post('/api/v1/auth/login').send({ email: OLENA.email, password });
    expect([(await login(OLENA.password)).status, (await login(NEW_PASSWORD)).status]).toEqual([
      401, 200,
    ]);
    expect((await refreshWith(testApp.app, other)).status).toBe(401);
    expect((await refreshWith(testApp.app, current)).status).toBe(200);
  });

  it('revokes every session on a password change that sends no refresh cookie', async () => {
    const current = await signUp(testApp.app, OLENA);

    const response = await changePassword(current.accessToken, {
      currentPassword: OLENA.password,
      newPassword: NEW_PASSWORD,
    });

    expect(response.status).toBe(204);
    expect((await refreshWith(testApp.app, current)).status).toBe(401);
  });

  it("leaves another user's sessions alone on a password change", async () => {
    const bohdan = await signUp(testApp.app, BOHDAN);
    const olena = await signUp(testApp.app, OLENA);

    const response = await changePassword(olena.accessToken, {
      currentPassword: OLENA.password,
      newPassword: NEW_PASSWORD,
    });

    expect(response.status).toBe(204);
    expect((await refreshWith(testApp.app, bohdan)).status).toBe(200);
  });

  it('publishes a JWKS that verifies an access token issued at sign-in', async () => {
    const { user, accessToken } = await signUp(testApp.app, OLENA);

    const response = await http().get('/.well-known/jwks.json');

    expect(response.status).toBe(200);
    const jwks = jwksResponseSchema.parse(response.body);
    const { payload, protectedHeader } = await jwtVerify(accessToken, createLocalJWKSet(jwks), {
      algorithms: ['RS256'],
    });
    expect(payload.sub).toBe(user.id);
    const [{ kid, n, e }] = jwks.keys;
    expect(protectedHeader.kid).toBe(kid);
    expect(kid).toBe(await calculateJwkThumbprint({ kty: 'RSA', n, e }));
  });
});
