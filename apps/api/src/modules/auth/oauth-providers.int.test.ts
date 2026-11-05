import type { OAuthProvider } from '@jobflow/shared';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { describe, expect, it } from 'vitest';

import { appTestingModule, useTestApp } from '../../test/app.js';
import { cacheControlOf } from '../../test/auth.js';
import { fakeOAuthClient, listOAuthProviders, startOAuth } from '../../test/oauth.js';
import { OAuthClient } from './oauth-client.js';

const UNAVAILABLE_URLS: Record<OAuthProvider, string> = {
  google: 'http://localhost:3000/login?oauth=unavailable&provider=google',
  github: 'http://localhost:3000/login?oauth=unavailable&provider=github',
};

async function expectUnavailableStart(app: NestExpressApplication, provider: OAuthProvider) {
  const { response, stateCookie } = await startOAuth(app, provider);

  expect([response.status, response.get('location')]).toEqual([302, UNAVAILABLE_URLS[provider]]);
  expect(stateCookie).toBeUndefined();
  expect(cacheControlOf(response)).toEqual(['no-store']);
}

describe('OAuth providers without OAUTH_* credentials', () => {
  const testApp = useTestApp();

  it('lists no provider', async () => {
    const response = await listOAuthProviders(testApp.app);

    expect([response.status, response.body]).toEqual([200, { items: [] }]);
  });

  it.each<OAuthProvider>(['google', 'github'])(
    'sends %s start to the sign-in page with oauth=unavailable instead of a 404',
    (provider) => expectUnavailableStart(testApp.app, provider),
  );
});

describe('OAuth providers with only GitHub set up', () => {
  const testApp = useTestApp(() =>
    appTestingModule()
      .overrideProvider(OAuthClient)
      .useValue(fakeOAuthClient({}, ['github'])),
  );

  it('lists only GitHub', async () => {
    const response = await listOAuthProviders(testApp.app);

    expect([response.status, response.body]).toEqual([200, { items: ['github'] }]);
  });

  it('sends Google start to the sign-in page with oauth=unavailable', () =>
    expectUnavailableStart(testApp.app, 'google'));

  it('redirects GitHub start to the provider with the oauth_state cookie', async () => {
    const { response, stateCookie } = await startOAuth(testApp.app, 'github');

    expect([response.status, response.get('location')]).toEqual([
      302,
      'https://github.com/login/oauth/authorize?state=state-github',
    ]);
    expect(stateCookie).toEqual(expect.any(String));
  });
});
