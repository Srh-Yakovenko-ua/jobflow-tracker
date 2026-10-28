import { jwtVerify } from 'jose';
import { describe, expect, it } from 'vitest';

import { testJwtKeys } from '../../test/auth.js';
import { AccessTokens, signAccessToken } from './access-tokens.js';
import { type OAuthState, OAuthStates } from './oauth-state.js';

const ISSUED_AT = new Date('2026-10-21T10:00:00.000Z');

const GITHUB_STATE: OAuthState = {
  provider: 'github',
  state: 'state-from-the-start-route',
  codeVerifier: 'verifier-from-the-start-route',
};

const states = new OAuthStates(testJwtKeys);

const encodePart = (part: object) => Buffer.from(JSON.stringify(part)).toString('base64url');

function withPayload(token: string, claims: object): string {
  const [header = '', , signature = ''] = token.split('.');
  return [header, encodePart(claims), signature].join('.');
}

const refusedStates: [string, () => Promise<string | undefined>][] = [
  [
    'whose payload was changed after signing',
    async () =>
      withPayload(await states.sign(GITHUB_STATE), { ...GITHUB_STATE, state: 'attacker-state' }),
  ],
  ['that expired', () => states.sign(GITHUB_STATE, ISSUED_AT)],
  ['that is not a JWT', () => Promise.resolve('not-a-jwt')],
  ['that is missing', () => Promise.resolve(undefined)],
  [
    'that is an access token',
    () => signAccessToken({ keys: testJwtKeys, userId: '0199f0a0-0000-7000-8000-000000000001' }),
  ],
];

describe('OAuthStates', () => {
  it('signs RS256 with the kid, the oauth-state typ, ten minutes of life and no user claims', async () => {
    const token = await states.sign(GITHUB_STATE, ISSUED_AT);

    const { payload, protectedHeader } = await jwtVerify(token, testJwtKeys.publicKey, {
      currentDate: ISSUED_AT,
    });
    expect(protectedHeader).toEqual({
      alg: 'RS256',
      kid: testJwtKeys.jwk.kid,
      typ: 'oauth-state+jwt',
    });
    expect(payload).toEqual({ ...GITHUB_STATE, iat: 1_792_576_800, exp: 1_792_577_400 });
  });

  it('reads back the provider, state and code verifier it signed', async () => {
    expect(await states.verify(await states.sign(GITHUB_STATE))).toEqual(GITHUB_STATE);
  });

  it.each(refusedStates)('refuses a state cookie %s with 400', async (_case, cookie) => {
    await expect(states.verify(await cookie())).rejects.toMatchObject({
      body: { status: 400, type: 'bad_request', detail: 'OAuth state is missing or invalid' },
    });
  });

  it('is refused as an access token with 401', async () => {
    const token = await states.sign(GITHUB_STATE);

    await expect(new AccessTokens(testJwtKeys).verify(token)).rejects.toMatchObject({
      body: { status: 401, type: 'unauthorized' },
    });
  });
});
