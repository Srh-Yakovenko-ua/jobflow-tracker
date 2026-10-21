import type { TokenScope } from '@jobflow/shared';
import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';

import { forbidden, unauthorized } from '../../common/app-error.js';
import { AccessTokens, type AccessUser } from './access-tokens.js';
import { IS_PUBLIC } from './public.decorator.js';
import type { HttpExchange } from './refresh-cookie.js';
import { DEFAULT_SCOPE, REQUIRED_SCOPE } from './require-scope.decorator.js';

const BEARER = /^Bearer\s+(\S+)$/i;

const CHALLENGE = { missing: 'Bearer', invalid: 'Bearer error="invalid_token"' } as const;

function bearerToken(header: string | undefined): string | undefined {
  return header === undefined ? undefined : BEARER.exec(header)?.[1];
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly accessTokens: AccessTokens,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC, targets) === true) {
      return true;
    }
    const http = context.switchToHttp();
    const exchange = { req: http.getRequest<Request>(), res: http.getResponse<Response>() };
    exchange.res.set('Cache-Control', 'no-store');
    const user = await this.authenticate(exchange);
    exchange.req.user = user;
    const required =
      this.reflector.getAllAndOverride<TokenScope | undefined>(REQUIRED_SCOPE, targets) ??
      DEFAULT_SCOPE;
    if (!user.scope.includes(required)) {
      throw forbidden(`Token lacks the ${required} scope`);
    }
    return true;
  }

  private async authenticate({ req, res }: HttpExchange): Promise<AccessUser> {
    const token = bearerToken(req.get('authorization'));
    if (token === undefined) {
      res.set('WWW-Authenticate', CHALLENGE.missing);
      throw unauthorized('Missing access token');
    }
    try {
      return await this.accessTokens.verify(token);
    } catch (error) {
      res.set('WWW-Authenticate', CHALLENGE.invalid);
      throw error;
    }
  }
}
