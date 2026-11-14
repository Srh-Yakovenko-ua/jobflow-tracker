import { LIVE_EVENTS } from '@jobflow/shared';
import { buildJobUpdate } from '@jobflow/shared/testing';
import type { Response } from 'supertest';
import { afterAll, describe, expect, it, onTestFinished, vi } from 'vitest';

import type { User } from '../generated/prisma/client.js';
import { LivePublisher } from '../modules/live/index.js';
import { rateLimitedTestingModule, useTestApp } from '../test/app.js';
import { accessTokenFor, authAs } from '../test/auth.js';
import { createUser, randomEmail } from '../test/factories.js';
import { callRoute } from '../test/http.js';
import {
  issueLiveTicket,
  LIVE_PATHS,
  liveEventsOf,
  liveHubSubscribed,
  streamPathOf,
} from '../test/live.js';
import { expectRateLimited, postFrom, randomClientIp } from '../test/rate-limit.js';
import { openSse, replyOf } from '../test/sse.js';

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

  it('answers 429 to a ticket request over the api limit, and a stream opened with an earlier ticket still delivers', async () => {
    const user = await createUser(testApp.prisma);
    const jobUpdate = buildJobUpdate({ status: 'failed', step: 2, errorType: 'ai_timeout' });
    await liveHubSubscribed(testApp.app);
    const first = await issueLiveTicket(testApp.app, user);
    const stream = await openSse(testApp.app, { path: streamPathOf(first.ticket) });
    onTestFinished(() => stream.close());
    await issueLiveTicket(testApp.app, user);

    const overTheLimit = await callRoute(testApp.app, {
      method: 'post',
      path: LIVE_PATHS.ticket,
      accessToken: await accessTokenFor(user),
    });
    await testApp.app
      .get(LivePublisher)
      .publish(user.id, { type: LIVE_EVENTS.jobUpdated, data: jobUpdate });

    expectRateLimited(overTheLimit, { windowSeconds: 60 });
    expect(stream.status).toBe(200);
    await expect
      .poll(() => liveEventsOf(stream.frames))
      .toMatchObject([{ type: 'job.updated', data: jobUpdate }]);
  });

  it("answers 429 with Retry-After to a stream opened over its user's api limit, and opens another user's stream", async () => {
    const [olena, bohdan] = [await createUser(testApp.prisma), await createUser(testApp.prisma)];
    const { ticket } = await issueLiveTicket(testApp.app, olena);
    await readMe(olena, 2);
    const other = await issueLiveTicket(testApp.app, bohdan);

    const refused = await openSse(testApp.app, { path: streamPathOf(ticket) });
    const opened = await openSse(testApp.app, { path: streamPathOf(other.ticket) });
    onTestFinished(async () => {
      await Promise.all([refused.close(), opened.close()]);
    });

    expectRateLimited(await replyOf(refused), { windowSeconds: 60 });
    expect(opened.status).toBe(200);
  });
});
