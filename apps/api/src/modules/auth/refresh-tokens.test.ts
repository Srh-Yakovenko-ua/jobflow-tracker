import { refreshTokenSchema } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { hashRefreshToken, newRefreshToken } from './refresh-tokens.js';

describe('refresh tokens', () => {
  it('draws a fresh 256-bit base64url value every time', () => {
    const tokens = [newRefreshToken(), newRefreshToken()];

    expect(tokens.map((token) => refreshTokenSchema.safeParse(token).success)).toEqual([
      true,
      true,
    ]);
    expect(Buffer.from(tokens[0] ?? '', 'base64url')).toHaveLength(32);
    expect(tokens[0]).not.toBe(tokens[1]);
  });

  it('stores the SHA-256 hex digest of the token, never the token', () => {
    expect(hashRefreshToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
