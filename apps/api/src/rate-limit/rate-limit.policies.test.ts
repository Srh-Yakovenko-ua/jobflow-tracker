import { describe, expect, it } from 'vitest';

import { RATE_LIMIT_POLICIES } from './rate-limit.policies.js';

const FIRST_IP = '203.0.113.7';
const SECOND_IP = '198.51.100.24';
const USER_ID = '01920000-0000-7000-8000-000000000001';

const loginKey = (ip: string, body: unknown) => RATE_LIMIT_POLICIES.login.keyOf({ ip, body });

const callerKey = (ip: string, userId?: string) =>
  RATE_LIMIT_POLICIES.api.keyOf({
    ip,
    body: {},
    ...(userId === undefined ? {} : { user: { id: userId, scope: ['user'] } }),
  });

describe('RATE_LIMIT_POLICIES', () => {
  it('counts case variants of one email from one IP together, and each IP apart', () => {
    const lower = loginKey(FIRST_IP, { email: 'olena@example.test', password: 'x' });
    const mixed = loginKey(FIRST_IP, { email: 'OLENA@Example.TEST', password: 'y' });
    const otherIp = loginKey(SECOND_IP, { email: 'olena@example.test' });

    expect(mixed).toBe(lower);
    expect(otherIp).not.toBe(lower);
    expect(lower.startsWith(`${FIRST_IP}:`)).toBe(true);
    expect(lower).not.toContain('olena');
  });

  it('still keys a login without an email string by the client IP', () => {
    const missing = loginKey(FIRST_IP, undefined);
    const notText = loginKey(FIRST_IP, { email: 42 });

    expect(notText).toBe(missing);
    expect(loginKey(SECOND_IP, undefined)).not.toBe(missing);
  });

  it('keys registration by the client IP alone', () => {
    const key = RATE_LIMIT_POLICIES.register.keyOf({ ip: FIRST_IP, body: { email: 'a@b.test' } });

    expect(key).toBe(FIRST_IP);
  });

  it('keys the caller by the user id and falls back to the client IP', () => {
    expect([callerKey(FIRST_IP, USER_ID), callerKey(SECOND_IP, USER_ID)]).toEqual([
      USER_ID,
      USER_ID,
    ]);
    expect(callerKey(FIRST_IP)).toBe(FIRST_IP);
  });

  it('counts per minute for login and api, per hour for register, ai and capture', () => {
    const windows = Object.entries(RATE_LIMIT_POLICIES).map(([policy, { durationSeconds }]) => [
      policy,
      durationSeconds,
    ]);

    expect(Object.fromEntries(windows)).toEqual({
      login: 60,
      register: 3600,
      ai: 3600,
      capture: 3600,
      api: 60,
    });
  });
});
