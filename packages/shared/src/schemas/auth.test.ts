import { describe, expect, it } from 'vitest';

import {
  authResponseSchema,
  changePasswordInputSchema,
  jwksResponseSchema,
  loginInputSchema,
  publicJwkSchema,
  refreshTokenBodySchema,
  registerInputSchema,
} from './auth.js';

const email = 'olena@example.com';
const refreshToken = 'a'.repeat(43);

describe('registerInputSchema', () => {
  it('refuses a 9-character password and accepts a 10-character one', () => {
    expect(registerInputSchema.safeParse({ email, password: 'a'.repeat(9) }).success).toBe(false);
    expect(registerInputSchema.safeParse({ email, password: 'a'.repeat(10) }).success).toBe(true);
  });

  it('refuses a password longer than 128 characters', () => {
    expect(registerInputSchema.safeParse({ email, password: 'a'.repeat(129) }).success).toBe(false);
  });

  it('refuses a malformed email', () => {
    expect(
      registerInputSchema.safeParse({ email: 'not-an-email', password: 'a'.repeat(10) }).success,
    ).toBe(false);
  });

  it('keeps displayName optional and trims it', () => {
    const password = 'a'.repeat(10);
    expect(registerInputSchema.parse({ email, password })).toEqual({ email, password });
    expect(registerInputSchema.parse({ email, password, displayName: '  Олена ' })).toEqual({
      email,
      password,
      displayName: 'Олена',
    });
  });
});

describe('loginInputSchema', () => {
  it('accepts a password shorter than the register minimum', () => {
    expect(loginInputSchema.safeParse({ email, password: 'short' }).success).toBe(true);
  });
});

describe('authResponseSchema', () => {
  const user = {
    id: '01920000-0000-7000-8000-000000000001',
    email,
    displayName: null,
    locale: 'uk',
  };
  const accessToken = 'eyJhbGciOiJSUzI1NiJ9.e30.c2ln';

  it('refuses a session without an access token', () => {
    expect(authResponseSchema.safeParse({ user }).success).toBe(false);
  });

  it('accepts a user without a display name and the access token', () => {
    expect(authResponseSchema.parse({ user, accessToken })).toEqual({ user, accessToken });
  });

  it('carries the refresh token in the body for a mobile client', () => {
    expect(authResponseSchema.parse({ user, accessToken, refreshToken })).toEqual({
      user,
      accessToken,
      refreshToken,
    });
  });
});

describe('refreshTokenBodySchema', () => {
  it('accepts no body, since the web client sends the cookie', () => {
    expect(refreshTokenBodySchema.parse(undefined)).toBeUndefined();
  });

  it('accepts an empty JSON body, which body-parser makes of a bodiless web request', () => {
    expect(refreshTokenBodySchema.parse({})).toEqual({});
  });

  it('accepts a 43-character base64url refresh token', () => {
    const token = 'Ab9_-'.repeat(8) + 'xyz';
    expect(refreshTokenBodySchema.parse({ refreshToken: token })).toEqual({ refreshToken: token });
  });

  it.each([
    ['42 characters', 'a'.repeat(42)],
    ['44 characters', 'a'.repeat(44)],
    ['a + outside base64url', '+'.repeat(43)],
  ])('refuses a refresh token of %s', (_label, token) => {
    expect(refreshTokenBodySchema.safeParse({ refreshToken: token }).success).toBe(false);
  });
});

describe('publicJwkSchema', () => {
  const jwk = { kty: 'RSA', alg: 'RS256', use: 'sig', kid: 'K'.repeat(43), n: 'sXch', e: 'AQAB' };

  it('accepts a JWKS with one RS256 signing key', () => {
    expect(jwksResponseSchema.parse({ keys: [jwk] })).toEqual({ keys: [jwk] });
  });

  it.each([
    ['the private exponent d', { ...jwk, d: 'c2VjcmV0' }],
    ['a 42-character kid', { ...jwk, kid: 'K'.repeat(42) }],
    ['a kid outside base64url', { ...jwk, kid: '+'.repeat(43) }],
    ['an ES256 algorithm', { ...jwk, alg: 'ES256' }],
  ])('refuses a key with %s', (_label, key) => {
    expect(publicJwkSchema.safeParse(key).success).toBe(false);
  });
});

describe('changePasswordInputSchema', () => {
  it('refuses a 9-character new password and accepts a 10-character one', () => {
    const currentPassword = 'short';
    expect(
      changePasswordInputSchema.safeParse({ currentPassword, newPassword: 'a'.repeat(9) }).success,
    ).toBe(false);
    expect(
      changePasswordInputSchema.safeParse({ currentPassword, newPassword: 'a'.repeat(10) }).success,
    ).toBe(true);
  });

  it('refuses an empty current password', () => {
    expect(
      changePasswordInputSchema.safeParse({ currentPassword: '', newPassword: 'a'.repeat(10) })
        .success,
    ).toBe(false);
  });
});
