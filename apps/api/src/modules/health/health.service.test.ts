import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { AppError } from '../../common/app-error.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RedisService } from '../../redis/redis.service.js';
import { FakeDependency } from '../../test/fake-dependency.js';
import { HealthService } from './health.service.js';

type DependencyState = { redisUp: boolean; postgresUp: boolean };

type HealthCase = DependencyState & { check: 'liveness' | 'readiness'; outcome: unknown };

async function healthServiceWith({ redisUp, postgresUp }: DependencyState): Promise<HealthService> {
  const redis = Object.assign(new FakeDependency(), { up: redisUp });
  const postgres = Object.assign(new FakeDependency(), { up: postgresUp });
  const moduleRef = await Test.createTestingModule({
    providers: [
      HealthService,
      { provide: RedisService, useValue: redis },
      { provide: PrismaService, useValue: postgres },
    ],
  }).compile();
  return moduleRef.get(HealthService);
}

async function outcomeOf(run: () => unknown): Promise<unknown> {
  try {
    return { answer: await run() };
  } catch (error) {
    return { error: error instanceof AppError ? error.body : error };
  }
}

const notReady = (detail: string) => ({
  error: { status: 503, type: 'not_ready', title: 'Service not ready', detail },
});

const BOTH_UP = { redisUp: true, postgresUp: true };

const CASES: Record<string, HealthCase> = {
  'reports liveness ok': { check: 'liveness', ...BOTH_UP, outcome: { answer: { status: 'ok' } } },
  'reports readiness ok while Redis and Postgres are up': {
    check: 'readiness',
    ...BOTH_UP,
    outcome: { answer: { status: 'ok', checks: { redis: 'up', postgres: 'up' } } },
  },
  'refuses readiness with 503 while Redis is down': {
    check: 'readiness',
    redisUp: false,
    postgresUp: true,
    outcome: notReady('Redis is not reachable'),
  },
  'refuses readiness with 503 while Postgres is down': {
    check: 'readiness',
    redisUp: true,
    postgresUp: false,
    outcome: notReady('Postgres is not reachable'),
  },
};

describe('HealthService', () => {
  it.each(Object.entries(CASES))('%s', async (_title, { check, outcome, ...state }) => {
    const service = await healthServiceWith(state);

    expect(await outcomeOf(() => service[check]())).toEqual(outcome);
  });
});
