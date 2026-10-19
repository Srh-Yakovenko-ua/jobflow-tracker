import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { AppModule } from '../../app.module.js';
import { APP_OPTIONS, configureApp } from '../../configure-app.js';
import { RedisService } from '../../redis/redis.service.js';

describe('readiness against a real Redis', () => {
  it('answers ready 200 and ends the Redis connection on close', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = configureApp(moduleRef.createNestApplication<NestExpressApplication>(APP_OPTIONS));
    await app.init();
    const { client } = app.get(RedisService);
    await expect.poll(() => client.status).toBe('ready');

    const response = await request(app.getHttpServer()).get('/api/v1/ready');
    await app.close();

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', checks: { redis: 'up' } });
    expect(client.status).toBe('end');
  });
});
