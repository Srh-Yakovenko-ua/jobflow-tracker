import { randomUUID } from 'node:crypto';

import type { TokenScope } from '@jobflow/shared';

import { type JwtKeys, signWithKeys } from './jwt-keys.js';

export const SERVICE_TOKEN_TTL_SECONDS = 60;

const SERVICE_TOKEN_CLAIMS = { iss: 'jobflow-api', aud: 'jobflow-ai', sub: 'worker' } as const;

export type SignServiceTokenInput = { keys: JwtKeys; scope: TokenScope; issuedAt: Date };

export function signServiceToken({
  keys,
  scope,
  issuedAt,
}: SignServiceTokenInput): Promise<string> {
  return signWithKeys({
    keys,
    claims: { ...SERVICE_TOKEN_CLAIMS, scope, jti: randomUUID() },
    ttlSeconds: SERVICE_TOKEN_TTL_SECONDS,
    issuedAt,
  });
}
