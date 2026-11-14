import { createHash, randomBytes } from 'node:crypto';

import { addMilliseconds, milliseconds } from 'date-fns';

export const REFRESH_TOKEN_TTL_MS = milliseconds({ days: 30 });

export const REFRESH_REUSE_GRACE_MS = milliseconds({ seconds: 30 });

export function newRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function refreshExpiryFrom(now: Date): Date {
  return addMilliseconds(now, REFRESH_TOKEN_TTL_MS);
}
