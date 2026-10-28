import type { OAuthProvider } from '@jobflow/shared';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request, { type Response } from 'supertest';

import { errorFor } from '../common/app-error.js';
import type { OAuthClient, OAuthProfile } from '../modules/auth/index.js';
import { BOHDAN, cookieOf, OLENA } from './auth.js';

const OAUTH_STATE_COOKIE = 'oauth_state';

const FAKE_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';

export type FakeOAuthClient = Pick<OAuthClient, 'begin' | 'profile'>;

export type OAuthStarted = { response: Response; state: string; stateCookie: string | undefined };

export type OAuthCallbackCall = {
  provider: OAuthProvider;
  code?: string;
  state?: string;
  error?: string;
  stateCookie?: string | undefined;
};

export type OAuthSignIn = { provider: OAuthProvider; code: string; state?: string };

export const GITHUB_OLENA: OAuthProfile = {
  providerUserId: '1001',
  email: OLENA.email,
  displayName: OLENA.displayName,
};

export const GITHUB_BOHDAN: OAuthProfile = { providerUserId: '1002', email: BOHDAN.email };

export function stateOf(url: string): string {
  return new URL(url).searchParams.get('state') ?? '';
}

export function fakeOAuthClient(profilesByCode: Record<string, OAuthProfile>): FakeOAuthClient {
  return {
    begin: (provider) => {
      const state = `state-${provider}`;
      const url = new URL(FAKE_AUTHORIZE_URL);
      url.searchParams.set('state', state);
      return Promise.resolve({ provider, state, codeVerifier: `verifier-${provider}`, url });
    },
    profile: ({ code }) => {
      const profile = profilesByCode[code];
      return profile === undefined
        ? Promise.reject(errorFor(400, 'The provider refused the sign-in'))
        : Promise.resolve(profile);
    },
  };
}

export async function startOAuth(
  app: NestExpressApplication,
  provider: OAuthProvider,
): Promise<OAuthStarted> {
  const response = await request(app.getHttpServer()).get(`/api/v1/auth/oauth/${provider}/start`);
  const stateCookie = cookieOf(response, OAUTH_STATE_COOKIE)?.value;
  return { response, state: stateOf(response.get('location') ?? ''), stateCookie };
}

export function callOAuthCallback(
  app: NestExpressApplication,
  { provider, stateCookie, ...query }: OAuthCallbackCall,
) {
  const call = request(app.getHttpServer())
    .get(`/api/v1/auth/oauth/${provider}/callback`)
    .query(query);
  return stateCookie === undefined
    ? call
    : call.set('cookie', `${OAUTH_STATE_COOKIE}=${stateCookie}`);
}

export async function signInWithOAuth(
  app: NestExpressApplication,
  { provider, code, state }: OAuthSignIn,
): Promise<Response> {
  const started = await startOAuth(app, provider);
  return callOAuthCallback(app, {
    provider,
    code,
    state: state ?? started.state,
    stateCookie: started.stateCookie,
  });
}
