import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { unauthorized } from '../../common/app-error.js';
import { AccessTokens } from './access-tokens.js';

const BEARER = /^Bearer\s+(\S+)$/i;

function bearerToken(header: string | undefined): string | undefined {
  return header === undefined ? undefined : BEARER.exec(header)?.[1];
}

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly accessTokens: AccessTokens) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = bearerToken(request.get('authorization'));
    if (token === undefined) {
      throw unauthorized('Missing access token');
    }
    request.user = await this.accessTokens.verify(token);
    return true;
  }
}
