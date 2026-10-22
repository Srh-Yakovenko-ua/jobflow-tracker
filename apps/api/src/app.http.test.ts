import { randomUUID } from 'node:crypto';

import { errorResponseSchema, type PaginationQuery, paginationQuerySchema } from '@jobflow/shared';
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { Public } from './modules/auth/index.js';
import { buildOpenApiDocument } from './openapi/document.js';
import { PrismaService } from './prisma/prisma.service.js';
import { RedisService } from './redis/redis.service.js';
import { appTestingModule, startTestApp } from './test/app.js';
import { authAs, jwksResponseSchema, testJwtKeys } from './test/auth.js';
import { FakeDependency } from './test/fake-dependency.js';
import { callRoute } from './test/http.js';
import { type LogLine, memoryLog, withLogSink } from './test/memory-log.js';
import { documentedOperations } from './test/openapi.js';
import { stubQueues } from './test/stub-queues.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const BEARER_OPERATIONS = documentedOperations(buildOpenApiDocument()).filter(
  ({ bearer }) => bearer,
);

@Controller('probe')
@Public()
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

type Dependencies = { redis: FakeDependency; postgres: FakeDependency };

function fakeDependencies(): Dependencies {
  return { redis: new FakeDependency(), postgres: new FakeDependency() };
}

function startApp({ redis, postgres }: Dependencies): Promise<NestExpressApplication> {
  return startTestApp(
    withLogSink(stubQueues(appTestingModule({ controllers: [ProbeController] })), log.sink)
      .overrideProvider(RedisService)
      .useValue(redis)
      .overrideProvider(PrismaService)
      .useValue(postgres),
  );
}

describe('the API over HTTP', () => {
  const dependencies = fakeDependencies();
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await startApp(dependencies);
  });

  beforeEach(() => {
    dependencies.redis.up = true;
    dependencies.postgres.up = true;
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

  it.each(['/', '/health', '/.well-known/openid-configuration'])(
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

  it('serves the JWKS at the root, outside /api/v1, with the one RSA signing key', async () => {
    const response = await request(app.getHttpServer()).get('/.well-known/jwks.json');

    expect(response.status).toBe(200);
    const [key] = jwksResponseSchema.parse(response.body).keys;
    expect(key.kid).toBe(testJwtKeys.jwk.kid);
  });

  it('answers the JWKS under /api/v1 with 404', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/.well-known/jwks.json');

    expect(response.status).toBe(404);
  });

  it.each(BEARER_OPERATIONS)(
    'answers the bearer route $method $path without an access token with 401',
    async ({ method, path }) => {
      const response = await callRoute(app, {
        method,
        path: path.replaceAll(/:\w+/g, () => randomUUID()),
      });

      expect(response.status).toBe(401);
      expect(errorResponseSchema.parse(response.body).type).toBe('unauthorized');
    },
  );

  it('logs an unknown route under /api/v1 once, in the request log', async () => {
    await request(app.getHttpServer()).get('/api/v1/does-not-exist').set('x-request-id', 'inside');

    expect(linesFor('inside').map((line) => line.msg)).toEqual(['request completed']);
  });

  it('logs a 404 outside /api/v1 once, as a rejected request', async () => {
    await request(app.getHttpServer()).get('/health').set('x-request-id', 'outside');

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

  it.each(['/api/v1/health', '/health'])(
    'sends the helmet security headers on %s and hides the framework',
    async (path) => {
      const response = await request(app.getHttpServer()).get(path);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers).not.toHaveProperty('x-powered-by');
    },
  );

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

  it('answers GET /api/v1/ready with 200 while Redis and Postgres are up', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/ready');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', checks: { redis: 'up', postgres: 'up' } });
  });

  it.each([
    { down: 'redis', detail: 'Redis is not reachable' },
    { down: 'postgres', detail: 'Postgres is not reachable' },
  ] as const)(
    'answers GET /api/v1/ready with 503 not_ready while $down is down',
    async ({ down, detail }) => {
      dependencies[down].up = false;

      const response = await request(app.getHttpServer()).get('/api/v1/ready');

      const body = errorResponseSchema.parse(response.body);
      expect(response.status).toBe(503);
      expect(body.type).toBe('not_ready');
      expect(body.detail).toBe(detail);
    },
  );
});

describe('the dev ping endpoint, Bull Board and Swagger UI outside development', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await startApp(fakeDependencies());
  });

  afterAll(async () => {
    await app.close();
  });

  const signedIn = () => authAs(app, { id: randomUUID() });

  it('answers POST /api/v1/dev/jobs/ping with 202 and the jobId, echoing x-request-id', async () => {
    const response = await (
      await signedIn()
    )
      .post('/api/v1/dev/jobs/ping')
      .set('x-request-id', 'ping-check')
      .send({});

    expect(response.status).toBe(202);
    expect(response.body).toEqual({ jobId: 'maintenance-1' });
    expect(response.headers['x-request-id']).toBe('ping-check');
  });

  it('refuses POST /api/v1/dev/jobs/ping without an access token with 401', async () => {
    const response = await request(app.getHttpServer()).post('/api/v1/dev/jobs/ping').send({});

    expect(response.status).toBe(401);
    expect(errorResponseSchema.parse(response.body).type).toBe('unauthorized');
  });

  it('refuses a holdMs over 60000 with 422 and the failing field', async () => {
    const response = await (await signedIn()).post('/api/v1/dev/jobs/ping').send({ holdMs: 70000 });

    const body = errorResponseSchema.parse(response.body);
    expect(response.status).toBe(422);
    expect(body.errors?.map((error) => error.path)).toEqual(['holdMs']);
  });

  it.each(['/admin/queues', '/api/docs', '/api/docs/openapi.json'])(
    'answers GET %s with 404 when NODE_ENV is test',
    async (path) => {
      const response = await request(app.getHttpServer()).get(path);

      expect(response.status).toBe(404);
      expect(errorResponseSchema.parse(response.body).type).toBe('not_found');
    },
  );
});

describe('shutdown', () => {
  it('closes the Redis connection and the Postgres pool when the app closes', async () => {
    const dependencies = fakeDependencies();
    const app = await startApp(dependencies);

    await app.close();

    expect([dependencies.redis.closed, dependencies.postgres.closed]).toEqual([true, true]);
  });
});
