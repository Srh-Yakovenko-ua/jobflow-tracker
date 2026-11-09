import type { TokenScope } from '@jobflow/shared';
import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';

import { forbidden, unauthorized } from '../../common/app-error.js';
import type { AccessUser } from './access-tokens.js';
import { type Credentials, CredentialsService } from './credentials.service.js';
import { IS_PUBLIC } from './public.decorator.js';
import type { HttpExchange } from './refresh-cookie.js';
import { DEFAULT_SCOPE, REQUIRED_SCOPE } from './require-scope.decorator.js';

const CREDENTIALS = /^(Bearer|Capture)\s+(\S+)$/i;

const CHALLENGE = {
  missing: 'Bearer',
  bearer: 'Bearer error="invalid_token"',
  capture: 'Capture error="invalid_token"',
} as const;

function credentialsOf(header: string | undefined): Credentials | undefined {
  const [, scheme, token] = CREDENTIALS.exec(header ?? '') ?? [];
  if (scheme === undefined || token === undefined) {
    return undefined;
  }
  return { scheme: scheme.toLowerCase() === 'capture' ? 'capture' : 'bearer', token };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly credentials: CredentialsService,
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
    const credentials = credentialsOf(req.get('authorization'));
    if (credentials === undefined) {
      res.set('WWW-Authenticate', CHALLENGE.missing);
      throw unauthorized('Missing access token');
    }
    try {
      return await this.credentials.verify(credentials);
    } catch (error) {
      res.set('WWW-Authenticate', CHALLENGE[credentials.scheme]);
      throw error;
    }
  }
}
