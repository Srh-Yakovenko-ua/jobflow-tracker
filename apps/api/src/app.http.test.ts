import { errorResponseSchema, type PaginationQuery, paginationQuerySchema } from '@jobflow/shared';
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { PARAMS_PROVIDER_TOKEN } from 'nestjs-pino';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from './app.module.js';
import { loggerParams } from './common/logger.js';
import { APP_OPTIONS, configureApp } from './configure-app.js';
import { RedisService } from './redis/redis.service.js';
import { type LogLine, memoryLog } from './test/memory-log.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

@Controller('probe')
class ProbeController {
  @Get('page')
  page(@Query({ schema: paginationQuerySchema }) query: PaginationQuery): PaginationQuery {
    return query;
  }

  @Get('crash')
  crash(): never {
    throw new Error('password authentication failed for user jobflow_app');
  }

  @Post('echo')
  echo(@Body() body: unknown): unknown {
    return body;
  }
}

const log = memoryLog();

function linesFor(requestId: string): LogLine[] {
  return log.parsed().filter((line) => line.requestId === requestId);
}

class FakeRedis {
  up = true;
  closed = false;

  isUp(): Promise<boolean> {
    return Promise.resolve(this.up);
  }

  onModuleDestroy(): Promise<void> {
    this.closed = true;
    return Promise.resolve();
  }
}

async function startApp(redis: FakeRedis): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [ProbeController],
  })
    .overrideProvider(RedisService)
    .useValue(redis)
    .overrideProvider(PARAMS_PROVIDER_TOKEN)
    .useValue(loggerParams(log.sink))
    .compile();
  const app = configureApp(moduleRef.createNestApplication<NestExpressApplication>(APP_OPTIONS));
  await app.init();
  return app;
}

describe('the API over HTTP', () => {
  const redis = new FakeRedis();
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await startApp(redis);
  });

  beforeEach(() => {
    redis.up = true;
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers GET /api/v1/health with 200 and status ok', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('answers an unknown route with 404 in the error format, requestId matching the header', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/does-not-exist');

    const body = errorResponseSchema.parse(response.body);
    expect(response.status).toBe(404);
    expect(body.type).toBe('not_found');
    expect(body.status).toBe(404);
    expect(body.requestId).toMatch(UUID);
    expect(body.requestId).toBe(response.headers['x-request-id']);
    expect(response.body).not.toHaveProperty('stack');
  });

  it.each(['/', '/health'])(
    'answers %s outside /api/v1 with 404 JSON in the error format',
    async (path) => {
      const response = await request(app.getHttpServer()).get(path);

      const body = errorResponseSchema.parse(response.body);
      expect(response.status).toBe(404);
      expect(response.headers['content-type']).toMatch(/^application\/json/);
      expect(body.type).toBe('not_found');
      expect(body.requestId).toBe(response.headers['x-request-id']);
    },
  );

  it('logs an unknown route under /api/v1 once, in the request log', async () => {
    await request(app.getHttpServer()).get('/api/v1/does-not-exist').set('x-request-id', 'inside');

    expect(linesFor('inside').map((line) => line.msg)).toEqual(['request completed']);
  });

  it('sends the security headers on a 404 outside /api/v1 and logs it once', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .set('x-request-id', 'outside');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toBeDefined();
    expect(response.headers).not.toHaveProperty('x-powered-by');
    expect(linesFor('outside')).toEqual([
      expect.objectContaining({
        level: 40,
        msg: 'request rejected',
        method: 'GET',
        url: '/health',
        status: 404,
      }),
    ]);
  });

  it('keeps a well-formed incoming x-request-id', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/does-not-exist')
      .set('x-request-id', 'be01-check');

    expect(response.headers['x-request-id']).toBe('be01-check');
    expect(response.body).toMatchObject({ requestId: 'be01-check' });
  });

  it('replaces an incoming x-request-id with unsafe characters', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('x-request-id', '"}{"level":60');

    expect(response.headers['x-request-id']).toMatch(UUID);
  });

  it('answers an invalid query with 422 validation_error and the failing field', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/probe/page?limit=0');

    const body = errorResponseSchema.parse(response.body);
    expect(response.status).toBe(422);
    expect(body.type).toBe('validation_error');
    expect(body.errors?.map((error) => error.path)).toEqual(['limit']);
    expect(body.requestId).toBe(response.headers['x-request-id']);
  });

  it('hands the parsed query to the handler', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/probe/page?limit=10');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ limit: 10 });
  });

  it('answers malformed JSON with 400 bad_request in the error format', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/probe/echo')
      .set('content-type', 'application/json')
      .set('x-request-id', 'bad-json')
      .send('{"company":');

    const body = errorResponseSchema.parse(response.body);
    expect(response.status).toBe(400);
    expect(body.type).toBe('bad_request');
    expect(body.requestId).toBe('bad-json');
    expect(linesFor('bad-json')).toEqual([expect.objectContaining({ level: 40, status: 400 })]);
  });

  it('answers a JSON body over 1 MB with 413 payload_too_large in the error format', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/probe/echo')
      .set('x-request-id', 'too-large')
      .send({ text: 'x'.repeat(1_100_000) });

    const body = errorResponseSchema.parse(response.body);
    expect(response.status).toBe(413);
    expect(body.type).toBe('payload_too_large');
    expect(body.requestId).toBe('too-large');
    expect(linesFor('too-large')).toEqual([expect.objectContaining({ level: 40, status: 413 })]);
  });

  it('accepts a JSON body just under 1 MB', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/probe/echo')
      .send({ text: 'x'.repeat(900_000) });

    expect(response.status).toBe(201);
  });

  it('answers a thrown Error with 500 internal_error and nothing but requestId', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/probe/crash')
      .set('x-request-id', 'crash');

    expect(response.status).toBe(500);
    expect(linesFor('crash').map((line) => line.msg)).toEqual([
      'request failed',
      'request errored',
    ]);
    expect(response.body).toEqual({
      type: 'internal_error',
      title: 'Internal error',
      status: 500,
      requestId: response.headers['x-request-id'],
    });
    expect(response.text).not.toContain('password');
  });

  it('sends the helmet security headers and hides the framework', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toBeDefined();
    expect(response.headers).not.toHaveProperty('x-powered-by');
  });

  it('allows a CORS preflight from WEB_ORIGIN with credentials', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/v1/health')
      .set('origin', 'http://localhost:3000')
      .set('access-control-request-method', 'GET');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('gives a CORS preflight from another origin no allow-origin header', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/v1/health')
      .set('origin', 'https://evil.example')
      .set('access-control-request-method', 'GET');

    expect(response.headers).not.toHaveProperty('access-control-allow-origin');
  });

  it('answers GET /api/v1/ready with 200 while Redis is up', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/ready');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', checks: { redis: 'up' } });
  });

  it('answers GET /api/v1/ready with 503 not_ready while Redis is down', async () => {
    redis.up = false;

    const response = await request(app.getHttpServer()).get('/api/v1/ready');

    const body = errorResponseSchema.parse(response.body);
    expect(response.status).toBe(503);
    expect(body.type).toBe('not_ready');
  });
});

describe('shutdown', () => {
  it('closes the Redis connection when the app closes', async () => {
    const redis = new FakeRedis();
    const app = await startApp(redis);

    await app.close();

    expect(redis.closed).toBe(true);
  });
});
