import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

import { authResponseSchema, type RegisterInput } from '@jobflow/shared';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DEPENDENCY_LIMITS } from '../common/probe.js';
import { type AppConfig, configModule } from '../config/app-config.js';
import { validateEnv } from '../config/env.js';
import { RedisService } from '../redis/redis.service.js';
import { rateLimitedTestingModule, useTestApp } from '../test/app.js';
import { OLENA } from '../test/auth.js';
import { exampleEnv } from '../test/example-env.js';
import { randomEmail } from '../test/factories.js';
import {
  expectRateLimited,
  postFrom,
  type PostFromInput,
  randomClientIp,
} from '../test/rate-limit.js';
import { startTcpProxy, type TcpProxy } from '../test/tcp-proxy.js';
import { type RateLimitOutcome, RateLimitService } from './rate-limit.service.js';

const PATHS = { login: '/api/v1/auth/login', register: '/api/v1/auth/register' } as const;

const CREDENTIALS = { email: OLENA.email, password: OLENA.password };

describe('rate limits on login and register by client IP', () => {
  const testApp = useTestApp(() => rateLimitedTestingModule());

  beforeAll(() => {
    testApp.app.set('trust proxy', 'loopback');
  });

  const config = () => testApp.app.get<AppConfig>(ConfigService);

  const post = (input: PostFromInput) => postFrom(testApp.app, input);

  const login = (ip: string) => post({ ip, path: PATHS.login, body: CREDENTIALS });

  async function registerOlena(): Promise<void> {
    const response = await post({ ip: randomClientIp(), path: PATHS.register, body: OLENA });
    expect(response.status).toBe(201);
  }

  async function failEveryAllowedLogin(ip: string): Promise<void> {
    const limit = config().get('RATE_LIMIT_LOGIN_PER_MINUTE', { infer: true });
    const body = { email: OLENA.email, password: 'not-the-password' };
    const attempts = Array.from({ length: limit }, () => post({ ip, path: PATHS.login, body }));
    const statuses = (await Promise.all(attempts)).map((response) => response.status);
    expect(statuses).toEqual([401, 401, 401, 401, 401]);
  }

  it('answers the sixth login attempt in a minute from one IP and email with 429, Retry-After and the DOC-04 body', async () => {
    await registerOlena();
    const ip = randomClientIp();
    await failEveryAllowedLogin(ip);

    const sixth = await login(ip).set('origin', config().get('WEB_ORIGIN', { infer: true }));

    expectRateLimited(sixth, { windowSeconds: 60 });
    expect(sixth.get('access-control-expose-headers')).toContain('Retry-After');
  });

  it('signs the same email in from another IP while the first IP is limited', async () => {
    await registerOlena();
    const limitedIp = randomClientIp();
    await failEveryAllowedLogin(limitedIp);

    const limited = await login(limitedIp);
    const elsewhere = await login(randomClientIp());

    expect([limited.status, elsewhere.status]).toEqual([429, 200]);
    expect(authResponseSchema.parse(elsewhere.body).user.email).toBe(OLENA.email);
  });

  it('answers the fourth registration in an hour from one IP with 429 and creates no user', async () => {
    const ip = randomClientIp();
    const limit = config().get('RATE_LIMIT_REGISTER_PER_HOUR', { infer: true });
    const account = (): RegisterInput => ({ ...OLENA, email: randomEmail() });
    const register = () => post({ ip, path: PATHS.register, body: account() });

    const allowed = await Promise.all(Array.from({ length: limit }, register));
    const fourth = await register();

    expect(allowed.map((response) => response.status)).toEqual([201, 201, 201]);
    expectRateLimited(fourth, { windowSeconds: 3600 });
    expect(await testApp.prisma.user.count()).toBe(3);
  });
});

type LimitsBehind = { config: AppConfig; redis: RedisService; limits: RateLimitService };

const SETTLE_LIMIT_MS = DEPENDENCY_LIMITS.pingTimeoutMs * 2;

function limitsBehind(redisUrl: string): LimitsBehind {
  const config: AppConfig = new ConfigService(validateEnv({ ...exampleEnv, REDIS_URL: redisUrl }));
  const redis = new RedisService(config);
  return { config, redis, limits: new RateLimitService(redis, config) };
}

function settledInTime(outcome: Promise<RateLimitOutcome>) {
  return Promise.race([outcome, delay(SETTLE_LIMIT_MS, 'still pending', { ref: false })]);
}

async function expectLoginLimitedPastLimit({ config, limits }: LimitsBehind): Promise<void> {
  const limit = config.get('RATE_LIMIT_LOGIN_PER_MINUTE', { infer: true });
  const key = randomClientIp();
  const attempts = Array.from({ length: limit + 1 }, () =>
    settledInTime(limits.consume('login', key)),
  );

  expect(await Promise.all(attempts)).toEqual([
    ...Array.from({ length: limit }, () => ({ limited: false })),
    { limited: true, retryAfterSeconds: 60 },
  ]);
}

describe('RateLimitService while Redis is unreachable', () => {
  const behind = limitsBehind('redis://127.0.0.1:1');

  afterAll(() => behind.redis.onModuleDestroy());

  it('keeps counting in memory and limits the attempt over the limit', () =>
    expectLoginLimitedPastLimit(behind));
});

describe('RateLimitService while Redis keeps the connection and never answers', () => {
  let proxy: TcpProxy;
  let behind: LimitsBehind;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [configModule] }).compile();
    const redisUrl = moduleRef.get<AppConfig>(ConfigService).get('REDIS_URL', { infer: true });
    proxy = await startTcpProxy(redisUrl);
    behind = limitsBehind(proxy.url);
    await once(behind.redis.client, 'ready');
    proxy.silence();
  });

  afterAll(async () => {
    behind.redis.client.disconnect();
    await proxy.close();
  });

  it('settles each attempt within the answer limit and limits the attempt over the limit', () =>
    expectLoginLimitedPastLimit(behind));
});
