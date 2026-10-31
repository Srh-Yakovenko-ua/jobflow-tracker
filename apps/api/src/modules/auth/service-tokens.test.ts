import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  serviceTokenFor,
  TEST_KEY_HEADER,
  testJwtKeys,
  verifyWithTestKey,
} from '../../test/auth.js';
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

  it('is refused by the API access token check with the generic 401', async () => {
    const token = await serviceTokenFor();

    await expect(new AccessTokens(testJwtKeys).verify(token)).rejects.toMatchObject({
      body: { status: 401, type: 'unauthorized', detail: 'Invalid access token' },
    });
  });
});
