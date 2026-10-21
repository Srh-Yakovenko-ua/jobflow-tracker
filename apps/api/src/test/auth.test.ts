import { jwtVerify } from 'jose';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { accessTokenFor, testJwtKeys, testKeys } from './auth.js';

const USER_ID = '01900000-0000-7000-8000-000000000001';

describe('the test access token', () => {
  it('verifies against the test public key as an RS256 token for the user, valid 15 minutes', async () => {
    const token = await accessTokenFor({ id: USER_ID });

    const { payload, protectedHeader } = await jwtVerify(token, testKeys.publicKey);

    expect(protectedHeader).toEqual({ alg: 'RS256', kid: testJwtKeys.jwk.kid });
    expect(payload.sub).toBe(USER_ID);
    expect(payload.scope).toBe('user analytics:read');
    expect(payload.jti).toEqual(expect.schemaMatching(z.uuid()));
    expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(900);
  });

  it('backdates the token when asked, so a test can present an expired one', async () => {
    const issuedAt = new Date('2026-10-21T10:00:00.000Z');

    const token = await accessTokenFor({ id: USER_ID }, { issuedAt });

    const { payload } = await jwtVerify(token, testKeys.publicKey, { currentDate: issuedAt });
    expect(payload.iat).toBe(1_792_576_800);
  });
});
