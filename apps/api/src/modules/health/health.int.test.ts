import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaService } from '../../prisma/prisma.service.js';
import { RedisService } from '../../redis/redis.service.js';
import { startTestApp } from '../../test/app.js';
import { authAs } from '../../test/auth.js';
import { resetDatabase } from '../../test/database.js';
import { createUser } from '../../test/factories.js';

describe('readiness against a real Redis and Postgres', () => {
  it('answers ready 200 with both checks up and ends the Redis connection on close', async () => {
    const app = await startTestApp();
    const { client } = app.get(RedisService);
    await expect.poll(() => client.status).toBe('ready');

    const response = await request(app.getHttpServer()).get('/api/v1/ready');
    await app.close();

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', checks: { redis: 'up', postgres: 'up' } });
    expect(client.status).toBe('end');
  });
});

describe('the health endpoint for a signed-in user', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await startTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers GET /api/v1/health with 200 and status ok', async () => {
    const agent = await authAs(app, await createUser(prisma));

    const response = await agent.get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});
