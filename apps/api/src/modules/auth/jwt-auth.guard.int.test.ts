import { randomUUID } from 'node:crypto';

import { errorResponseSchema, type TokenScope, USER_TOKEN_SCOPES } from '@jobflow/shared';
import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DEPENDENCY_LIMITS } from '../../common/probe.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { appTestingModule, startTestApp, useTestApp } from '../../test/app.js';
import {
  accessTokenFor,
  analyticsServiceTokenFor,
  cacheControlOf,
  serviceTokenFor,
} from '../../test/auth.js';
import { captureAuthorization, signedInWithCaptureToken } from '../../test/capture.js';
import { configuredDatabaseUrl, prismaAt } from '../../test/database.js';
import { statusAndDetail } from '../../test/http.js';
import { startTcpProxy, type TcpProxy } from '../../test/tcp-proxy.js';
import type { AccessUser } from './access-tokens.js';
import { CaptureTokensRepository } from './capture-tokens.repository.js';
import { CurrentUser } from './current-user.decorator.js';
import { Public } from './public.decorator.js';
import { RequireScope } from './require-scope.decorator.js';

@Controller('guard-probe')
class GuardProbeController {
  @Get('signed-in')
  signedIn(@CurrentUser() user: AccessUser): AccessUser {
    return user;
  }

  @Get('open')
  @Public()
  open(): { open: true } {
    return { open: true };
  }

  @Post('capture')
  @HttpCode(200)
  @RequireScope('capture')
  capture(@CurrentUser() user: AccessUser): AccessUser {
    return user;
  }
}

const USER = { id: randomUUID() };

type ScopeCase = {
  scope: readonly TokenScope[];
  route: 'default' | 'capture';
  status: 200 | 403;
  body: object;
};

type CredentialsCase = {
  credentials: string;
  authorization: (captureToken: string) => string | Promise<string>;
  detail: string;
  challenge: string;
};

const CAPTURE_REFUSED = { type: 'forbidden', detail: 'Token lacks the capture scope' };

const USER_REFUSED = { type: 'forbidden', detail: 'Token lacks the user scope' };

describe('the global access token guard', () => {
  const testApp = useTestApp(() => appTestingModule({ controllers: [GuardProbeController] }));

  const http = () => request(testApp.app.getHttpServer());

  const routes = {
    default: () => http().get('/api/v1/guard-probe/signed-in'),
    capture: () => http().post('/api/v1/guard-probe/capture'),
  };

  const bearer = async (scope: readonly TokenScope[]) =>
    `Bearer ${await accessTokenFor(USER, { scope })}`;

  it('refuses a route with no decorator without an access token with 401', async () => {
    const response = await routes.default();

    expect(response.status).toBe(401);
    expect(errorResponseSchema.parse(response.body)).toMatchObject({
      type: 'unauthorized',
      detail: 'Missing access token',
    });
  });

  it('hands a route with no decorator the token user as { id, scope, token }, marked no-store', async () => {
    const issuedAt = new Date(Math.floor(Date.now() / 60_000) * 60_000);
    const accessToken = await accessTokenFor(USER, { issuedAt });
    const response = await routes.default().set('authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: USER.id,
      scope: ['user', 'analytics:read'],
      token: {
        issuedAt: issuedAt.toISOString(),
        expiresAt: new Date(issuedAt.getTime() + 900_000).toISOString(),
      },
    });
    expect(cacheControlOf(response)).toEqual(['no-store']);
  });

  it.each([
    { scope: 'ai:invoke', sign: () => serviceTokenFor() },
    { scope: 'analytics:read', sign: () => analyticsServiceTokenFor(USER.id) },
  ])(
    'refuses the worker service token scoped $scope on a route with no decorator with 401',
    async ({ sign }) => {
      const token = await sign();

      const response = await routes.default().set('authorization', `Bearer ${token}`);

      expect(response.status).toBe(401);
      expect(errorResponseSchema.parse(response.body)).toMatchObject({
        type: 'unauthorized',
        detail: 'Invalid access token',
      });
      expect(response.get('www-authenticate')).toBe('Bearer error="invalid_token"');
    },
  );

  it('answers a @Public() route without an access token with 200', async () => {
    const response = await http().get('/api/v1/guard-probe/open');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ open: true });
  });

  it.each<ScopeCase>([
    { scope: USER_TOKEN_SCOPES, route: 'capture', status: 403, body: CAPTURE_REFUSED },
    {
      scope: ['capture'],
      route: 'capture',
      status: 200,
      body: { id: USER.id, scope: ['capture'] },
    },
    { scope: ['capture'], route: 'default', status: 403, body: USER_REFUSED },
    { scope: ['analytics:read'], route: 'default', status: 403, body: USER_REFUSED },
    { scope: ['analytics:read'], route: 'capture', status: 403, body: CAPTURE_REFUSED },
  ])(
    'answers the $route route for a token scoped $scope with $status and no Bearer challenge',
    async ({ scope, route, status, body }) => {
      const response = await routes[route]().set('authorization', await bearer(scope));

      expect(response.status).toBe(status);
      expect(response.body).toMatchObject(body);
      expect(response.get('www-authenticate')).toBeUndefined();
    },
  );

  it('hands the capture route the owner of a capture token as { id, scope, captureTokenId }, marked no-store', async () => {
    const { userId, captureTokenId, captureToken } = await signedInWithCaptureToken(testApp);

    const response = await routes.capture().set(captureAuthorization(captureToken));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: userId, scope: ['capture'], captureTokenId });
    expect(cacheControlOf(response)).toEqual(['no-store']);
  });

  it('refuses a capture token on a route with no decorator with 403 and no challenge', async () => {
    const { captureToken } = await signedInWithCaptureToken(testApp);

    const response = await routes.default().set(captureAuthorization(captureToken));

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject(USER_REFUSED);
    expect(response.get('www-authenticate')).toBeUndefined();
  });

  it.each<CredentialsCase>([
    {
      credentials: 'an unknown capture token',
      authorization: () => 'Capture unknown-capture-token',
      detail: 'Invalid capture token',
      challenge: 'Capture error="invalid_token"',
    },
    {
      credentials: 'an access token scoped capture sent as Capture',
      authorization: async () => `Capture ${await accessTokenFor(USER, { scope: ['capture'] })}`,
      detail: 'Invalid capture token',
      challenge: 'Capture error="invalid_token"',
    },
    {
      credentials: 'a capture token sent as Bearer',
      authorization: (token) => `Bearer ${token}`,
      detail: 'Invalid access token',
      challenge: 'Bearer error="invalid_token"',
    },
  ])(
    'refuses $credentials on the capture route with 401 and the $challenge challenge',
    async ({ authorization, detail, challenge }) => {
      const { captureToken } = await signedInWithCaptureToken(testApp);
      const header = await authorization(captureToken);

      const response = await routes.capture().set('authorization', header);

      expect(statusAndDetail(response)).toEqual([401, detail]);
      expect(response.get('www-authenticate')).toBe(challenge);
    },
  );
});

const LOOKUP_LIMITS_MS = {
  refused: DEPENDENCY_LIMITS.connectTimeoutMs + 1500,
  silent: DEPENDENCY_LIMITS.queryTimeoutMs + 2000,
} as const;

function probeAppWithCaptureTokensAt(prisma: PrismaService): Promise<NestExpressApplication> {
  return startTestApp(
    appTestingModule({ controllers: [GuardProbeController] })
      .overrideProvider(CaptureTokensRepository)
      .useValue(new CaptureTokensRepository(prisma)),
  );
}

async function expectInternalErrorWithoutChallenge(
  app: NestExpressApplication | undefined,
): Promise<void> {
  if (!app) throw new Error('the probe app did not start');
  const response = await request(app.getHttpServer())
    .post('/api/v1/guard-probe/capture')
    .set('authorization', 'Capture any-capture-token');

  expect(response.status).toBe(500);
  expect(errorResponseSchema.parse(response.body).type).toBe('internal_error');
  expect(response.body).not.toHaveProperty('detail');
  expect(response.get('www-authenticate')).toBeUndefined();
}

describe('the capture token lookup while Postgres refuses the connection', () => {
  const prisma = prismaAt('postgresql://u:p@127.0.0.1:1/x');
  let app: NestExpressApplication | undefined;

  beforeAll(async () => {
    app = await probeAppWithCaptureTokensAt(prisma);
  });

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  it('answers 500 without a challenge', { timeout: LOOKUP_LIMITS_MS.refused }, () =>
    expectInternalErrorWithoutChallenge(app),
  );
});

describe('the capture token lookup while Postgres keeps the connection and never answers', () => {
  let proxy: TcpProxy | undefined;
  let prisma: PrismaService | undefined;
  let app: NestExpressApplication | undefined;

  beforeAll(async () => {
    proxy = await startTcpProxy(await configuredDatabaseUrl());
    prisma = prismaAt(proxy.url);
    await prisma.$queryRaw`SELECT 1`;
    proxy.silence();
    app = await probeAppWithCaptureTokensAt(prisma);
  });

  afterAll(async () => {
    await app?.close();
    await proxy?.close();
    await prisma?.$disconnect();
  });

  it('answers 500 without a challenge', { timeout: LOOKUP_LIMITS_MS.silent }, () =>
    expectInternalErrorWithoutChallenge(app),
  );
});
