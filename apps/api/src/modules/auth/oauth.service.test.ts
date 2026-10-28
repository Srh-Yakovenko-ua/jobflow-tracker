import type { AuthUser, OAuthProvider } from '@jobflow/shared';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { validateEnv } from '../../config/env.js';
import { testJwtKeys } from '../../test/auth.js';
import { exampleEnv } from '../../test/example-env.js';
import { fakeOAuthClient, GITHUB_OLENA, stateOf } from '../../test/oauth.js';
import { AuthService, type OAuthIdentity } from './auth.service.js';
import { JwtKeys } from './jwt-keys.js';
import { OAuthService } from './oauth.service.js';
import { OAuthClient } from './oauth-client.js';
import { OAuthStates } from './oauth-state.js';

type CallbackCase = { case: string; startWith: OAuthProvider; state?: string };

const OLENA_USER: AuthUser = {
  id: '0199f0a0-0000-7000-8000-000000000001',
  email: GITHUB_OLENA.email,
  displayName: 'Олена',
  locale: 'uk',
};

class FakeAccounts {
  readonly signIns: OAuthIdentity[] = [];

  signInWithOAuth(identity: OAuthIdentity): Promise<AuthUser> {
    this.signIns.push(identity);
    return Promise.resolve(OLENA_USER);
  }
}

async function oauthServiceWith() {
  const accounts = new FakeAccounts();
  const moduleRef = await Test.createTestingModule({
    providers: [
      OAuthService,
      OAuthStates,
      { provide: JwtKeys, useValue: testJwtKeys },
      { provide: ConfigService, useValue: new ConfigService(validateEnv(exampleEnv)) },
      { provide: OAuthClient, useValue: fakeOAuthClient({ 'olena-code': GITHUB_OLENA }) },
      { provide: AuthService, useValue: accounts },
    ],
  }).compile();
  return { accounts, service: moduleRef.get(OAuthService) };
}

async function finishGitHub(
  service: OAuthService,
  { startWith, state }: Omit<CallbackCase, 'case'>,
) {
  const { url, stateToken } = await service.start(startWith);
  const query = { code: 'olena-code', state: state ?? stateOf(url) };
  return service.finish({ provider: 'github', query, stateToken });
}

describe('OAuthService.start', () => {
  it('sends the user to the provider and keeps the state and code verifier in the state token', async () => {
    const { service } = await oauthServiceWith();

    const { url, stateToken } = await service.start('github');

    expect(url).toBe('https://github.com/login/oauth/authorize?state=state-github');
    expect(await new OAuthStates(testJwtKeys).verify(stateToken)).toEqual({
      provider: 'github',
      state: 'state-github',
      codeVerifier: 'verifier-github',
    });
  });

  it('lands on the board of WEB_ORIGIN, and on its sign-in page when the user declined', async () => {
    const { service } = await oauthServiceWith();

    expect([service.landingUrl, service.deniedUrl]).toEqual([
      'http://localhost:3000/board',
      'http://localhost:3000/login?oauth=denied',
    ]);
  });
});

describe('OAuthService.finish', () => {
  it('signs in with the GitHub account the code belongs to', async () => {
    const { accounts, service } = await oauthServiceWith();

    const user = await finishGitHub(service, { startWith: 'github' });

    expect(user).toEqual(OLENA_USER);
    expect(accounts.signIns).toEqual([{ ...GITHUB_OLENA, provider: 'github' }]);
  });

  it.each<CallbackCase>([
    { case: 'a state that differs from the state cookie', startWith: 'github', state: 'tampered' },
    { case: 'the state cookie of another provider', startWith: 'google' },
  ])('refuses $case with 400 and signs nobody in', async (callback) => {
    const { accounts, service } = await oauthServiceWith();

    await expect(finishGitHub(service, callback)).rejects.toMatchObject({
      body: { status: 400, type: 'bad_request', detail: 'OAuth state does not match' },
    });
    expect(accounts.signIns).toEqual([]);
  });
});
