import { describe, expect, it } from 'vitest';

import { authResponseSchema, loginInputSchema, registerInputSchema } from './auth.js';

const email = 'olena@example.com';

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
  it('accepts a user without a display name', () => {
    const user = {
      id: '01920000-0000-7000-8000-000000000001',
      email,
      displayName: null,
      locale: 'uk',
    };
    expect(authResponseSchema.parse({ user })).toEqual({ user });
  });
});
