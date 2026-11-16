import type { TokenScope } from '@jobflow/shared';
import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';

import { forbidden } from '../../common/app-error.js';
import { authenticateRequest } from './authenticate-request.js';
import { CredentialsService } from './credentials.service.js';
import { IS_PUBLIC } from './public.decorator.js';
import { DEFAULT_SCOPE, REQUIRED_SCOPE } from './require-scope.decorator.js';

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
    const user = await authenticateRequest(this.credentials, exchange);
    exchange.req.user = user;
    const required =
      this.reflector.getAllAndOverride<TokenScope | undefined>(REQUIRED_SCOPE, targets) ??
      DEFAULT_SCOPE;
    if (!user.scope.includes(required)) {
      throw forbidden(`Token lacks the ${required} scope`);
    }
    return true;
  }
}
