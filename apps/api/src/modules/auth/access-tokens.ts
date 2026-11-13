import { randomUUID } from 'node:crypto';

import { type TokenScope, USER_TOKEN_SCOPES } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';
import { errors, type JWTPayload, type JWTVerifyOptions } from 'jose';
import { z } from 'zod';

import { type AppError, tokenExpired, unauthorized } from '../../common/app-error.js';
import { JwtKeys, signWithKeys, verifyWithKeys } from './jwt-keys.js';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export type AccessUser = { id: string; scope: string[]; captureTokenId?: string };

export type SignAccessTokenInput = {
  keys: JwtKeys;
  userId: string;
  issuedAt?: Date | undefined;
  scope?: readonly TokenScope[] | undefined;
};

const ACCESS_TOKEN_CLAIMS: JWTPayload = {
  iss: 'jobflow-api',
  aud: ['jobflow-api', 'jobflow-analytics'],
};

const VERIFY_OPTIONS: JWTVerifyOptions = {
  algorithms: ['RS256'],
  issuer: 'jobflow-api',
  audience: 'jobflow-api',
  requiredClaims: ['sub', 'jti', 'scope', 'exp'],
};

const accessClaimsSchema = z.object({ sub: z.uuid(), scope: z.string() });

function toAccessTokenError(error: unknown): AppError {
  return error instanceof errors.JWTExpired ? tokenExpired() : unauthorized('Invalid access token');
}

export function signAccessToken({
  keys,
  userId,
  issuedAt = new Date(),
  scope = USER_TOKEN_SCOPES,
}: SignAccessTokenInput): Promise<string> {
  return signWithKeys({
    keys,
    claims: {
      ...ACCESS_TOKEN_CLAIMS,
      scope: scope.join(' '),
      sub: userId,
      jti: randomUUID(),
    },
    ttlSeconds: ACCESS_TOKEN_TTL_SECONDS,
    issuedAt,
  });
}

@Injectable()
export class AccessTokens {
  constructor(private readonly keys: JwtKeys) {}

  sign(userId: string): Promise<string> {
    return signAccessToken({ keys: this.keys, userId });
  }

  async verify(token: string): Promise<AccessUser> {
    const { sub, scope } = await verifyWithKeys({
      keys: this.keys,
      token,
      options: VERIFY_OPTIONS,
      schema: accessClaimsSchema,
      refusal: toAccessTokenError,
    });
    return { id: sub, scope: scope.split(' ') };
  }
}
