import { randomUUID } from 'node:crypto';

import { errorResponseSchema, type TokenScope, USER_TOKEN_SCOPES } from '@jobflow/shared';
import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { appTestingModule, useTestApp } from '../../test/app.js';
import { accessTokenFor, cacheControlOf } from '../../test/auth.js';
import type { AccessUser } from './access-tokens.js';
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

  it('hands a route with no decorator the token user as { id, scope }, marked no-store', async () => {
    const response = await routes.default().set('authorization', await bearer(USER_TOKEN_SCOPES));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: USER.id, scope: ['user', 'analytics:read'] });
    expect(cacheControlOf(response)).toEqual(['no-store']);
  });

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
});
