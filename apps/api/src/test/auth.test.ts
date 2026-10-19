import { jwtVerify } from 'jose';
import { describe, expect, it } from 'vitest';

import { accessTokenFor, testKeys } from './auth.js';

const USER_ID = '01900000-0000-7000-8000-000000000001';

describe('the test access token', () => {
  it('verifies against the test public key as an RS256 token for the user, valid 15 minutes', async () => {
    const token = await accessTokenFor({ id: USER_ID });

    const { payload, protectedHeader } = await jwtVerify(token, testKeys.publicKey);

    expect(protectedHeader.alg).toBe('RS256');
    expect(payload.sub).toBe(USER_ID);
    expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(900);
  });
});
