import {
  type AuthUser,
  DEFAULT_SEARCH_TITLE,
  errorResponseSchema,
  meResponseSchema,
  sessionTokensSchema,
} from '@jobflow/shared';
import request, { type Response } from 'supertest';
import { describe, expect, it } from 'vitest';

import { appTestingModule, useTestApp } from '../../test/app.js';
import {
  BOHDAN,
  cacheControlOf,
  clearedCookie,
  cookieOf,
  OLENA,
  REFRESH_COOKIE_ATTRIBUTES,
  refreshCookieOf,
  refreshTokenFromCookie,
  refreshWith,
  signIn,
  signUp,
} from '../../test/auth.js';
import {
  callOAuthCallback,
  fakeOAuthClient,
  GITHUB_BOHDAN,
  GITHUB_OLENA,
  signInWithOAuth,
  startOAuth,
} from '../../test/oauth.js';
import { outboxRows } from '../../test/outbox.js';
import { OAuthClient } from './oauth-client.js';

const PROFILES_BY_CODE = {
  'olena-code': GITHUB_OLENA,
  'bohdan-code': GITHUB_BOHDAN,
  'olena-second-github-code': { ...GITHUB_OLENA, providerUserId: '1003' },
};

const OAUTH_STATE_PATH = '/api/v1/auth/oauth';

const BOARD_URL = 'http://localhost:3000/board';

describe('sign in with Google and GitHub', () => {
  const testApp = useTestApp(() =>
    appTestingModule().overrideProvider(OAuthClient).useValue(fakeOAuthClient(PROFILES_BY_CODE)),
  );

  const githubSignIn = (code: string) => signInWithOAuth(testApp.app, { provider: 'github', code });

  async function accessTokenOf(signedIn: Response): Promise<string> {
    const refreshToken = refreshTokenFromCookie(signedIn);
    const refreshed = await refreshWith(testApp.app, { refreshToken });
    return sessionTokensSchema.parse(refreshed.body).accessToken;
  }

  async function userOf(signedIn: Response): Promise<AuthUser> {
    const accessToken = await accessTokenOf(signedIn);
    const me = await request(testApp.app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('authorization', `Bearer ${accessToken}`);
    return meResponseSchema.parse(me.body).user;
  }

  const oauthAccounts = () =>
    testApp.prisma.oAuthAccount.findMany({
      orderBy: { providerUserId: 'asc' },
      select: { provider: true, providerUserId: true, userId: true },
    });

  it('redirects start to the provider with a ten minute oauth_state cookie on the OAuth path and no-store', async () => {
    const { response } = await startOAuth(testApp.app, 'github');

    expect(response.status).toBe(302);
    expect(response.get('location')).toBe(
      'https://github.com/login/oauth/authorize?state=state-github',
    );
    expect(cookieOf(response, 'oauth_state')).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: OAUTH_STATE_PATH,
      maxAge: 600,
    });
    expect(cacheControlOf(response)).toEqual(['no-store']);
  });

  it('signs a first GitHub sign-in up without a password and lands on the board with a session', async () => {
    const response = await githubSignIn('olena-code');

    expect(response.status).toBe(302);
    expect(response.get('location')).toBe(BOARD_URL);
    expect(refreshCookieOf(response)).toMatchObject(REFRESH_COOKIE_ATTRIBUTES);
    expect(cookieOf(response, 'oauth_state')).toMatchObject(clearedCookie(OAUTH_STATE_PATH));
    const user = await userOf(response);
    expect(user).toMatchObject({ email: OLENA.email, displayName: 'Олена', locale: 'uk' });
    const userId = user.id;
    const users = await testApp.prisma.user.findMany({ select: { id: true, passwordHash: true } });
    expect(users).toEqual([{ id: userId, passwordHash: null }]);
    expect(await oauthAccounts()).toEqual([{ provider: 'github', providerUserId: '1001', userId }]);
    expect(await testApp.prisma.userSettings.count({ where: { userId } })).toBe(1);
    const searches = await testApp.prisma.search.findMany({ where: { userId, status: 'active' } });
    expect(searches.map((search) => search.title)).toEqual([DEFAULT_SEARCH_TITLE]);
    expect(await outboxRows(testApp.prisma)).toEqual([
      { aggregate: 'user', aggregateId: userId, eventType: 'user.registered', payload: { userId } },
    ]);
  });

  it('answers the refresh after a GitHub sign-in with 200 and an access token', async () => {
    const response = await githubSignIn('olena-code');

    const refreshed = await refreshWith(testApp.app, {
      refreshToken: refreshTokenFromCookie(response),
    });

    expect(refreshed.status).toBe(200);
    expect(sessionTokensSchema.safeParse(refreshed.body).success).toBe(true);
  });

  it('signs a second GitHub sign-in into the same user', async () => {
    const first = await userOf(await githubSignIn('olena-code'));

    const second = await userOf(await githubSignIn('olena-code'));

    expect(second.id).toBe(first.id);
    expect(await testApp.prisma.user.count()).toBe(1);
    expect(await testApp.prisma.oAuthAccount.count()).toBe(1);
  });

  it("signs Olena's GitHub account into Olena while Bohdan's is linked, never into Bohdan", async () => {
    const bohdan = await userOf(await githubSignIn('bohdan-code'));

    const olena = await userOf(await githubSignIn('olena-code'));

    expect(olena).toMatchObject({ email: OLENA.email });
    expect(olena.id).not.toBe(bohdan.id);
    expect(await oauthAccounts()).toEqual([
      { provider: 'github', providerUserId: '1001', userId: olena.id },
      { provider: 'github', providerUserId: '1002', userId: bohdan.id },
    ]);
  });

  it('links GitHub to the password user with the same verified email and ends that password and its sessions', async () => {
    const bohdan = await signUp(testApp.app, BOHDAN);
    const registered = await signUp(testApp.app, OLENA);

    const linked = await userOf(await githubSignIn('olena-code'));

    expect(linked).toEqual(registered.user);
    expect(await oauthAccounts()).toEqual([
      { provider: 'github', providerUserId: '1001', userId: registered.user.id },
    ]);
    const passwordLogin = await request(testApp.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: OLENA.email, password: OLENA.password });
    const oldSession = await refreshWith(testApp.app, { refreshToken: registered.refreshToken });
    expect([passwordLogin.status, oldSession.status]).toEqual([401, 401]);
    const bohdanSession = await refreshWith(testApp.app, { refreshToken: bohdan.refreshToken });
    expect(bohdanSession.status).toBe(200);
    expect((await signIn(testApp.app, BOHDAN)).user).toEqual(bohdan.user);
  });

  it('refuses a second GitHub account for a user who already has one with 409', async () => {
    await githubSignIn('olena-code');

    const response = await githubSignIn('olena-second-github-code');

    expect(response.status).toBe(409);
    expect(errorResponseSchema.parse(response.body)).toMatchObject({
      type: 'conflict',
      detail: 'This account is already linked to another GitHub account',
    });
    expect(refreshCookieOf(response)).toBeUndefined();
    expect(await testApp.prisma.oAuthAccount.count()).toBe(1);
  });

  it('refuses a tampered state with 400 in the error format, with no session and no user', async () => {
    const response = await signInWithOAuth(testApp.app, {
      provider: 'github',
      code: 'olena-code',
      state: 'tampered-state',
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      type: 'bad_request',
      title: 'Bad request',
      status: 400,
      detail: 'OAuth state does not match',
      requestId: response.get('x-request-id'),
    });
    expect(refreshCookieOf(response)).toBeUndefined();
    expect(await testApp.prisma.user.count()).toBe(0);
  });

  it('refuses a callback without the oauth_state cookie with 400', async () => {
    await startOAuth(testApp.app, 'github');

    const response = await callOAuthCallback(testApp.app, {
      provider: 'github',
      code: 'olena-code',
      state: 'state-github',
    });

    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(response.body).detail).toBe(
      'OAuth state is missing or invalid',
    );
    expect(await testApp.prisma.user.count()).toBe(0);
  });

  it('refuses the Google state cookie on the GitHub callback with 400', async () => {
    const google = await startOAuth(testApp.app, 'google');

    const response = await callOAuthCallback(testApp.app, {
      provider: 'github',
      code: 'olena-code',
      state: google.state,
      stateCookie: google.stateCookie,
    });

    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(response.body).detail).toBe('OAuth state does not match');
    expect(await testApp.prisma.user.count()).toBe(0);
  });

  it('sends a sign-in the user declined at the provider back to the login page without a session', async () => {
    const github = await startOAuth(testApp.app, 'github');

    const response = await callOAuthCallback(testApp.app, {
      provider: 'github',
      error: 'access_denied',
      state: github.state,
      stateCookie: github.stateCookie,
    });

    expect(response.status).toBe(302);
    expect(response.get('location')).toBe('http://localhost:3000/login?oauth=denied');
    expect(cookieOf(response, 'oauth_state')).toMatchObject(clearedCookie(OAUTH_STATE_PATH));
    expect(refreshCookieOf(response)).toBeUndefined();
    expect(await testApp.prisma.user.count()).toBe(0);
  });

  it('refuses a callback with neither a code nor a provider error with 422', async () => {
    const github = await startOAuth(testApp.app, 'github');

    const response = await callOAuthCallback(testApp.app, {
      provider: 'github',
      state: github.state,
      stateCookie: github.stateCookie,
    });

    expect(response.status).toBe(422);
    expect(errorResponseSchema.parse(response.body).errors).toEqual([
      { path: '', message: 'Expected code and state, or error' },
    ]);
  });
});
