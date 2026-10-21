import { generateKeyPair, jwtVerify, SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { testJwtKeys } from '../../test/auth.js';
import { AccessTokens, signAccessToken } from './access-tokens.js';
import { jwtKeysFrom } from './jwt-keys.js';

const USER_ID = '0199f0a0-0000-7000-8000-000000000001';

const ISSUED_AT = new Date('2026-10-21T10:00:00.000Z');

const accessTokens = new AccessTokens(testJwtKeys);

const otherKeys = await jwtKeysFrom(await generateKeyPair('RS256'));

const encodePart = (part: object) => Buffer.from(JSON.stringify(part)).toString('base64url');

const claims = { sub: USER_ID, scope: 'user analytics:read', jti: crypto.randomUUID() };

const signedByTestKey = (jwt: SignJWT) =>
  jwt.setProtectedHeader({ alg: 'RS256', kid: testJwtKeys.jwk.kid }).sign(testJwtKeys.privateKey);

const forgedTokens: [string, () => Promise<string>][] = [
  ['signed by another key', () => signAccessToken({ keys: otherKeys, userId: USER_ID })],
  ['that is not a JWT', () => Promise.resolve('not-a-jwt')],
  ['with alg none', () => Promise.resolve(`${encodePart({ alg: 'none' })}.${encodePart(claims)}.`)],
  [
    'signed with HS256',
    () =>
      new SignJWT(claims)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('15m')
        .sign(new TextEncoder().encode('a shared secret of at least 32 bytes')),
  ],
  [
    'without a scope claim',
    () =>
      signedByTestKey(
        new SignJWT({})
          .setSubject(USER_ID)
          .setJti(crypto.randomUUID())
          .setIssuedAt()
          .setExpirationTime('15m'),
      ),
  ],
  ['without an exp claim', () => signedByTestKey(new SignJWT(claims).setIssuedAt())],
];

describe('signAccessToken', () => {
  it('signs RS256 with the kid, the user as sub, a uuid jti, the user scopes and 15 minutes of life', async () => {
    const token = await signAccessToken({
      keys: testJwtKeys,
      userId: USER_ID,
      issuedAt: ISSUED_AT,
    });

    const { payload, protectedHeader } = await jwtVerify(token, testJwtKeys.publicKey, {
      currentDate: ISSUED_AT,
    });
    expect(protectedHeader).toEqual({ alg: 'RS256', kid: testJwtKeys.jwk.kid });
    const { jti, ...claims } = payload;
    expect(claims).toEqual({
      sub: USER_ID,
      scope: 'user analytics:read',
      iat: 1_792_576_800,
      exp: 1_792_577_700,
    });
    expect(jti).toEqual(expect.schemaMatching(z.uuid()));
  });
});

describe('AccessTokens.verify', () => {
  it('answers the user id and its scopes for a token it signed', async () => {
    const token = await accessTokens.sign(USER_ID);

    expect(await accessTokens.verify(token)).toEqual({
      id: USER_ID,
      scope: ['user', 'analytics:read'],
    });
  });

  it('refuses an expired token with 401 token_expired', async () => {
    const token = await signAccessToken({
      keys: testJwtKeys,
      userId: USER_ID,
      issuedAt: ISSUED_AT,
    });

    await expect(accessTokens.verify(token)).rejects.toMatchObject({
      body: { status: 401, type: 'token_expired', title: 'Token expired' },
    });
  });

  it.each(forgedTokens)('refuses a token %s with the generic 401', async (_case, forge) => {
    await expect(accessTokens.verify(await forge())).rejects.toMatchObject({
      body: { status: 401, type: 'unauthorized', detail: 'Invalid access token' },
    });
  });
});
