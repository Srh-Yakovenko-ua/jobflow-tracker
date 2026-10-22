import type { Response } from 'supertest';
import { afterAll, describe, expect, it, vi } from 'vitest';

import type { User } from '../generated/prisma/client.js';
import { rateLimitedTestingModule, useTestApp } from '../test/app.js';
import { authAs } from '../test/auth.js';
import { createUser, randomEmail } from '../test/factories.js';
import { expectRateLimited, postFrom, randomClientIp } from '../test/rate-limit.js';

vi.hoisted(() => {
  vi.stubEnv('RATE_LIMIT_LOGIN_PER_MINUTE', '2');
  vi.stubEnv('RATE_LIMIT_API_PER_MINUTE', '3');
});

type LoginAttempts = { statuses: number[]; third: Response };

describe('rate limits taken from the environment', () => {
  const testApp = useTestApp(() => rateLimitedTestingModule());

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  async function threeLoginAttempts(
    forwardedFor: () => string | undefined,
  ): Promise<LoginAttempts> {
    const body = { email: randomEmail(), password: 'not-the-password' };
    const attempt = () =>
      postFrom(testApp.app, { ip: forwardedFor(), path: '/api/v1/auth/login', body });
    const first = await attempt();
    const second = await attempt();
    const third = await attempt();
    return { statuses: [first, second, third].map((response) => response.status), third };
  }

  async function readMe(user: Pick<User, 'id'>, times: number): Promise<number[]> {
    const agent = await authAs(testApp.app, user);
    const statuses: number[] = [];
    for (let read = 0; read < times; read += 1) {
      statuses.push((await agent.get('/api/v1/auth/me')).status);
    }
    return statuses;
  }

  it('answers the third login attempt with 429 when RATE_LIMIT_LOGIN_PER_MINUTE is 2', async () => {
    const { statuses, third } = await threeLoginAttempts(() => undefined);

    expect(statuses).toEqual([401, 401, 429]);
    expectRateLimited(third, { windowSeconds: 60 });
  });

  it('limits one user to three reads a minute when RATE_LIMIT_API_PER_MINUTE is 3, and not another', async () => {
    const olena = await createUser(testApp.prisma);
    const bohdan = await createUser(testApp.prisma);

    const olenaReads = await readMe(olena, 4);
    const bohdanReads = await readMe(bohdan, 1);

    expect(olenaReads).toEqual([200, 200, 200, 429]);
    expect(bohdanReads).toEqual([200]);
  });

  it('keeps counting one email when each attempt sends another X-Forwarded-For', async () => {
    const { statuses, third } = await threeLoginAttempts(randomClientIp);

    expect(statuses).toEqual([401, 401, 429]);
    expectRateLimited(third, { windowSeconds: 60 });
  });
});
