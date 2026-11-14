import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  analyticsServiceTokenFor,
  serviceTokenFor,
  TEST_KEY_HEADER,
  testJwtKeys,
  verifyWithTestKey,
} from '../../test/auth.js';
import { OLENA_ID } from '../../test/service-fixtures.js';
import { AccessTokens } from './access-tokens.js';
import { signServiceToken } from './service-tokens.js';

const ISSUED_AT = new Date('2026-10-31T10:00:00.000Z');

describe('signServiceToken', () => {
  it('signs a 60 s RS256 token from the worker for jobflow-ai with the kid, the scope and a uuid jti', async () => {
    const token = await signServiceToken({
      keys: testJwtKeys,
      scope: 'ai:invoke',
      issuedAt: ISSUED_AT,
    });

    const { protectedHeader, jti, claims } = await verifyWithTestKey(token, ISSUED_AT);
    expect(protectedHeader).toEqual(TEST_KEY_HEADER);
    expect(claims).toEqual({
      iss: 'jobflow-api',
      aud: 'jobflow-ai',
      sub: 'worker',
      scope: 'ai:invoke',
      iat: 1_793_440_800,
      exp: 1_793_440_860,
    });
    expect(jti).toEqual(expect.schemaMatching(z.uuid()));
  });

  it('signs a 60 s RS256 analytics:read token for jobflow-analytics whose subject is the user', async () => {
    const token = await signServiceToken({
      keys: testJwtKeys,
      scope: 'analytics:read',
      userId: OLENA_ID,
      issuedAt: ISSUED_AT,
    });

    const { protectedHeader, jti, claims } = await verifyWithTestKey(token, ISSUED_AT);
    expect(protectedHeader).toEqual(TEST_KEY_HEADER);
    expect(claims).toEqual({
      iss: 'jobflow-api',
      aud: 'jobflow-analytics',
      sub: OLENA_ID,
      scope: 'analytics:read',
      iat: 1_793_440_800,
      exp: 1_793_440_860,
    });
    expect(jti).toEqual(expect.schemaMatching(z.uuid()));
  });

  it.each([
    { scope: 'ai:invoke', sign: () => serviceTokenFor() },
    { scope: 'analytics:read', sign: () => analyticsServiceTokenFor(OLENA_ID) },
  ])(
    'is refused for scope $scope by the API access token check with the generic 401',
    async ({ sign }) => {
      const token = await sign();

      await expect(new AccessTokens(testJwtKeys).verify(token)).rejects.toMatchObject({
        body: { status: 401, type: 'unauthorized', detail: 'Invalid access token' },
      });
    },
  );
});
