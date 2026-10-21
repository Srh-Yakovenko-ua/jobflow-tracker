import { createHash, randomBytes } from 'node:crypto';

export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function newRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function refreshExpiryFrom(now: Date): Date {
  return new Date(now.getTime() + REFRESH_TOKEN_TTL_MS);
}
