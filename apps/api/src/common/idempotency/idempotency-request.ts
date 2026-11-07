import { createHash } from 'node:crypto';

import type { Request } from 'express';
import { z } from 'zod';

import { validation } from '../app-error.js';

export const IDEMPOTENCY_LIMITS = {
  replayWindowMinutes: 24 * 60,
  leaseMinutes: 1,
  keyMaxLength: 255,
} as const;

export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

export const IDEMPOTENCY_CONFLICTS = {
  mismatch: 'Idempotency-Key was already used with another request',
  inProgress: 'A request with this Idempotency-Key is still in progress',
} as const;

export const idempotencyKeySchema = z.string().min(1).max(IDEMPOTENCY_LIMITS.keyMaxLength);

export const storedReplySchema = z.object({ body: z.json() });

export type StoredReply = z.infer<typeof storedReplySchema>;

export type HandlerReply = { body: unknown };

export type KeyedRequest = Pick<Request, 'headers'>;

export type HashedRequest = { method: string; originalUrl: string; body: unknown };

export function keyOf(req: KeyedRequest): string | undefined {
  const header = req.headers[IDEMPOTENCY_HEADER.toLowerCase()];
  if (header === undefined) return undefined;
  const parsed = idempotencyKeySchema.safeParse(header);
  if (parsed.success) return parsed.data;
  throw validation(
    parsed.error.issues.map(({ message }) => ({ path: IDEMPOTENCY_HEADER, message })),
  );
}

export function requestHashOf({ method, originalUrl, body }: HashedRequest): string {
  return createHash('sha256')
    .update(JSON.stringify([method, originalUrl, body ?? null]))
    .digest('hex');
}

export function storedReplyOf({ body }: HandlerReply): StoredReply {
  const sent: unknown = JSON.parse(JSON.stringify(body));
  return storedReplySchema.parse({ body: sent });
}
