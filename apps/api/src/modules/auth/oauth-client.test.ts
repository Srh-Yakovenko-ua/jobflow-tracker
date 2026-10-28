import { createHash } from 'node:crypto';

import { ConfigService } from '@nestjs/config';
import { SignJWT } from 'jose';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEPENDENCY_LIMITS } from '../../common/probe.js';
import { validateEnv } from '../../config/env.js';
import { testJwtKeys } from '../../test/auth.js';
import { exampleEnv } from '../../test/example-env.js';
import { type OAuthCallback, OAuthClient } from './oauth-client.js';

const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';
const GITHUB_EMAILS_URL = 'https://api.github.com/user/emails';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

const CREDENTIALS = {
  OAUTH_GITHUB_CLIENT_ID: 'github-client-id',
  OAUTH_GITHUB_CLIENT_SECRET: 'github-client-secret',
  OAUTH_GOOGLE_CLIENT_ID: 'google-client-id',
  OAUTH_GOOGLE_CLIENT_SECRET: 'google-client-secret',
};

const GITHUB_CALLBACK: OAuthCallback = {
  provider: 'github',
  code: 'github-code',
  state: 'github-state',
  codeVerifier: 'github-verifier',
};

const GOOGLE_CALLBACK: OAuthCallback = {
  provider: 'google',
  code: 'google-code',
  state: 'google-state',
  codeVerifier: 'google-verifier',
};

const GITHUB_TOKENS = {
  access_token: 'gho_github_access',
  token_type: 'bearer',
  scope: 'user:email',
};

const GITHUB_USER = { id: 583231, login: 'octo-olena', name: 'Олена' };

const GITHUB_EMAILS = [
  { email: 'olena.old@example.test', primary: false, verified: true },
  { email: 'olena@example.test', primary: true, verified: true },
];

type FetchCall = { url: string; body: Record<string, string> | undefined; headers: Headers };

type Reply = (init: RequestInit | undefined) => Response | Promise<Response>;

type Replies = Record<string, Reply>;

const oauthClient = clientWith(CREDENTIALS);

function clientWith(credentials: Partial<typeof CREDENTIALS>): OAuthClient {
  return new OAuthClient(new ConfigService(validateEnv({ ...exampleEnv, ...credentials })));
}

function routeFetch(replies: Replies): FetchCall[] {
  const calls: FetchCall[] = [];
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    const body = init?.body instanceof URLSearchParams ? Object.fromEntries(init.body) : undefined;
    calls.push({ url, body, headers: new Headers(init?.headers) });
    const reply = replies[url];
    return reply ? Promise.resolve(reply(init)) : Promise.reject(new Error(`No fake for ${url}`));
  });
  return calls;
}

const githubReplies = (overrides: Replies = {}): Replies => ({
  [GITHUB_TOKEN_URL]: () => Response.json(GITHUB_TOKENS),
  [GITHUB_USER_URL]: () => Response.json(GITHUB_USER),
  [GITHUB_EMAILS_URL]: () => Response.json(GITHUB_EMAILS),
  ...overrides,
});

function googleIdToken(claims: object): Promise<string> {
  return new SignJWT({ email: 'olena@example.test', name: 'Олена', ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: testJwtKeys.jwk.kid })
    .setIssuer('https://accounts.google.com')
    .setAudience('google-client-id')
    .setSubject('109876543210987654321')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(testJwtKeys.privateKey);
}

async function googleTokens(claims: object): Promise<Response> {
  const idToken = await googleIdToken(claims);
  return Response.json({
    access_token: 'ya29.google-access',
    token_type: 'Bearer',
    id_token: idToken,
  });
}

function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new Error('aborted');
}

const stalled: Reply = (init) =>
  new Promise((_resolve, reject) => {
    const signal = init?.signal;
    if (!signal) {
      return;
    }
    if (signal.aborted) {
      reject(abortReason(signal));
      return;
    }
    signal.addEventListener('abort', () => {
      reject(abortReason(signal));
    });
  });

const refusedConnection = new TypeError('fetch failed', {
  cause: Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:443'), { code: 'ECONNREFUSED' }),
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('OAuthClient.begin', () => {
  it('builds the GitHub authorize URL with the client, callback, scope, S256 challenge and state', async () => {
    const { provider, url, state, codeVerifier } = await oauthClient.begin('github');

    expect(provider).toBe('github');
    expect(`${url.origin}${url.pathname}`).toBe('https://github.com/login/oauth/authorize');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'github-client-id',
      redirect_uri: 'http://localhost:4000/api/v1/auth/oauth/github/callback',
      response_type: 'code',
      scope: 'user:email',
      code_challenge: createHash('sha256').update(codeVerifier).digest('base64url'),
      code_challenge_method: 'S256',
      state,
    });
    expect([state, codeVerifier]).toEqual([
      expect.stringMatching(/^[\w-]{43}$/),
      expect.stringMatching(/^[\w-]{43}$/),
    ]);
  });

  it('answers 404 for a provider without credentials', async () => {
    const githubOnly = clientWith({
      OAUTH_GITHUB_CLIENT_ID: CREDENTIALS.OAUTH_GITHUB_CLIENT_ID,
      OAUTH_GITHUB_CLIENT_SECRET: CREDENTIALS.OAUTH_GITHUB_CLIENT_SECRET,
    });
    const notConfigured = { body: { status: 404, detail: 'OAuth provider is not configured' } };

    await expect(githubOnly.begin('google')).rejects.toMatchObject(notConfigured);
    await expect(githubOnly.profile(GOOGLE_CALLBACK)).rejects.toMatchObject(notConfigured);
  });
});

describe('OAuthClient.profile', () => {
  it.each([
    { name: 'Олена', displayName: 'Олена' },
    { name: null, displayName: 'octo-olena' },
  ])(
    'reads the GitHub profile from /user and the primary verified email (name $name)',
    async ({ name, displayName }) => {
      routeFetch(
        githubReplies({ [GITHUB_USER_URL]: () => Response.json({ ...GITHUB_USER, name }) }),
      );

      expect(await oauthClient.profile(GITHUB_CALLBACK)).toEqual({
        providerUserId: '583231',
        email: 'olena@example.test',
        displayName,
      });
    },
  );

  it('sends the code, the PKCE verifier and the callback to GitHub and the token to api.github.com', async () => {
    const calls = routeFetch(githubReplies());

    await oauthClient.profile(GITHUB_CALLBACK);

    expect(calls.map(({ url }) => url)).toEqual([
      GITHUB_TOKEN_URL,
      GITHUB_USER_URL,
      GITHUB_EMAILS_URL,
    ]);
    expect(calls[0]?.body).toEqual({
      grant_type: 'authorization_code',
      code: 'github-code',
      code_verifier: 'github-verifier',
      redirect_uri: 'http://localhost:4000/api/v1/auth/oauth/github/callback',
      client_id: 'github-client-id',
      client_secret: 'github-client-secret',
    });
    expect(
      calls.slice(1).map(({ headers }) => [headers.get('authorization'), headers.get('accept')]),
    ).toEqual([
      ['Bearer gho_github_access', 'application/vnd.github+json'],
      ['Bearer gho_github_access', 'application/vnd.github+json'],
    ]);
  });

  it('refuses a GitHub account without a verified primary email with 400', async () => {
    const unverifiedPrimary = [
      { email: 'olena@example.test', primary: true, verified: false },
      { email: 'olena.work@example.test', primary: false, verified: true },
    ];
    routeFetch(githubReplies({ [GITHUB_EMAILS_URL]: () => Response.json(unverifiedPrimary) }));

    await expect(oauthClient.profile(GITHUB_CALLBACK)).rejects.toMatchObject({
      body: { status: 400, detail: 'The provider account has no verified email' },
    });
  });

  it('reads the Google profile from the verified id_token claims', async () => {
    routeFetch({ [GOOGLE_TOKEN_URL]: () => googleTokens({ email_verified: true }) });

    expect(await oauthClient.profile(GOOGLE_CALLBACK)).toEqual({
      providerUserId: '109876543210987654321',
      email: 'olena@example.test',
      displayName: 'Олена',
    });
  });

  it('refuses a Google account whose email is not verified with 400', async () => {
    routeFetch({ [GOOGLE_TOKEN_URL]: () => googleTokens({ email_verified: false }) });

    await expect(oauthClient.profile(GOOGLE_CALLBACK)).rejects.toMatchObject({
      body: { status: 400, detail: 'The provider account has no verified email' },
    });
  });

  it.each([
    {
      refusal: 'Google answers invalid_grant',
      callback: GOOGLE_CALLBACK,
      replies: {
        [GOOGLE_TOKEN_URL]: () =>
          Response.json(
            { error: 'invalid_grant', error_description: 'Bad Request' },
            { status: 400 },
          ),
      },
    },
    {
      refusal: 'GitHub answers bad_verification_code with 200',
      callback: GITHUB_CALLBACK,
      replies: githubReplies({
        [GITHUB_TOKEN_URL]: () =>
          Response.json({
            error: 'bad_verification_code',
            error_description: 'The code passed is incorrect or expired.',
          }),
      }),
    },
  ])('answers 400 when $refusal', async ({ callback, replies }) => {
    routeFetch(replies);

    await expect(oauthClient.profile(callback)).rejects.toMatchObject({
      body: { status: 400, type: 'bad_request', detail: 'The provider refused the sign-in' },
    });
  });

  it.each([
    {
      failure: 'Google refuses the connection',
      callback: GOOGLE_CALLBACK,
      replies: { [GOOGLE_TOKEN_URL]: () => Promise.reject(refusedConnection) },
      detail: 'Google is not reachable',
    },
    {
      failure: 'api.github.com answers 502',
      callback: GITHUB_CALLBACK,
      replies: githubReplies({
        [GITHUB_USER_URL]: () => new Response('Bad gateway', { status: 502 }),
      }),
      detail: 'GitHub is not reachable',
    },
  ])('answers 503 when $failure', async ({ callback, replies, detail }) => {
    routeFetch(replies);

    await expect(oauthClient.profile(callback)).rejects.toMatchObject({
      body: { status: 503, type: 'not_ready', detail },
    });
  });

  it('gives up on a stalled provider at the provider time limit with 503', async () => {
    const timedOut = AbortSignal.abort(
      new DOMException('The operation timed out.', 'TimeoutError'),
    );
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timedOut);
    routeFetch({ [GITHUB_TOKEN_URL]: stalled });

    await expect(oauthClient.profile(GITHUB_CALLBACK)).rejects.toMatchObject({
      body: { status: 503, detail: 'GitHub is not reachable' },
    });
    expect(timeout).toHaveBeenCalledWith(DEPENDENCY_LIMITS.providerTimeoutMs);
  });
});
