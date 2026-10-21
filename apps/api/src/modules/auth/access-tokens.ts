import { randomUUID } from 'node:crypto';

import { USER_TOKEN_SCOPES } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';
import { errors, jwtVerify, type JWTVerifyOptions, SignJWT } from 'jose';
import { z } from 'zod';

import { type AppError, tokenExpired, unauthorized } from '../../common/app-error.js';
import { JwtKeys } from './jwt-keys.js';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export type AccessUser = { id: string; scope: string[] };

export type SignAccessTokenInput = { keys: JwtKeys; userId: string; issuedAt?: Date | undefined };

const VERIFY_OPTIONS: JWTVerifyOptions = {
  algorithms: ['RS256'],
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
}: SignAccessTokenInput): Promise<string> {
  const issuedAtSeconds = Math.floor(issuedAt.getTime() / 1000);
  return new SignJWT({ scope: USER_TOKEN_SCOPES.join(' ') })
    .setProtectedHeader({ alg: 'RS256', kid: keys.jwk.kid })
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuedAt(issuedAtSeconds)
    .setExpirationTime(issuedAtSeconds + ACCESS_TOKEN_TTL_SECONDS)
    .sign(keys.privateKey);
}

@Injectable()
export class AccessTokens {
  constructor(private readonly keys: JwtKeys) {}

  sign(userId: string): Promise<string> {
    return signAccessToken({ keys: this.keys, userId });
  }

  async verify(token: string): Promise<AccessUser> {
    try {
      const { payload } = await jwtVerify(token, this.keys.publicKey, VERIFY_OPTIONS);
      const { sub, scope } = accessClaimsSchema.parse(payload);
      return { id: sub, scope: scope.split(' ') };
    } catch (error) {
      throw toAccessTokenError(error);
    }
  }
}
