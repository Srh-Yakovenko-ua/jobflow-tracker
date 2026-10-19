import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { RedisService } from './redis.service.js';

const UNREACHABLE_REDIS = new ConfigService({ REDIS_URL: 'redis://127.0.0.1:1' });

async function compileUnreachable() {
  const moduleRef = await Test.createTestingModule({
    providers: [RedisService, { provide: ConfigService, useValue: UNREACHABLE_REDIS }],
  }).compile();
  return { moduleRef, redis: moduleRef.get(RedisService) };
}

describe('RedisService while Redis is unreachable', () => {
  it('reports down at once and still ends the connection on shutdown', async () => {
    const { moduleRef, redis } = await compileUnreachable();

    const up = await redis.isUp();
    await moduleRef.close();

    expect(up).toBe(false);
    expect(redis.client.status).toBe('end');
  });

  it('finishes shutdown while the client waits to reconnect', async () => {
    const { moduleRef, redis } = await compileUnreachable();
    await expect.poll(() => redis.client.status).toBe('reconnecting');

    await expect(moduleRef.close()).resolves.toBeUndefined();
  });
});
