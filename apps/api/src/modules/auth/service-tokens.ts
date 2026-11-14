import { randomUUID } from 'node:crypto';

import { type JwtKeys, signWithKeys } from './jwt-keys.js';

export const SERVICE_TOKEN_TTL_SECONDS = 60;

export type ServiceTokenGrant =
  { scope: 'ai:invoke' } | { scope: 'analytics:read'; userId: string };

export type SignServiceTokenInput = ServiceTokenGrant & { keys: JwtKeys; issuedAt: Date };

const SERVICE_AUDIENCES = {
  'ai:invoke': 'jobflow-ai',
  'analytics:read': 'jobflow-analytics',
} as const satisfies Record<ServiceTokenGrant['scope'], string>;

const subjectOf = (grant: ServiceTokenGrant) =>
  grant.scope === 'analytics:read' ? grant.userId : 'worker';

export function signServiceToken(input: SignServiceTokenInput): Promise<string> {
  const { keys, issuedAt, scope } = input;
  return signWithKeys({
    keys,
    claims: {
      iss: 'jobflow-api',
      aud: SERVICE_AUDIENCES[scope],
      sub: subjectOf(input),
      scope,
      jti: randomUUID(),
    },
    ttlSeconds: SERVICE_TOKEN_TTL_SECONDS,
    issuedAt,
  });
}
