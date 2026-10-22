import { randomInt } from 'node:crypto';

import { errorResponseSchema } from '@jobflow/shared';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request, { type Response } from 'supertest';
import { expect } from 'vitest';

import { ERROR_TYPES } from '../common/app-error.js';
import type { RateLimitService } from '../rate-limit/rate-limit.service.js';

export type PostFromInput = { ip?: string | undefined; path: string; body: object };

export type RateLimitWindow = { windowSeconds: number };

export const NO_RATE_LIMIT: Pick<RateLimitService, 'consume'> = {
  consume: () => Promise.resolve({ limited: false }),
};

export function randomClientIp(): string {
  return ['10', ...Array.from({ length: 3 }, () => String(randomInt(256)))].join('.');
}

export function postFrom(app: NestExpressApplication, { ip, path, body }: PostFromInput) {
  const call = request(app.getHttpServer()).post(path);
  return (ip === undefined ? call : call.set('x-forwarded-for', ip)).send(body);
}

export function expectRateLimited(response: Response, { windowSeconds }: RateLimitWindow): void {
  const retryAfter = Number(response.get('retry-after'));
  expect(response.status).toBe(429);
  expect(Number.isInteger(retryAfter)).toBe(true);
  expect(retryAfter).toBeGreaterThanOrEqual(1);
  expect(retryAfter).toBeLessThanOrEqual(windowSeconds);
  expect(errorResponseSchema.parse(response.body)).toMatchObject({
    ...ERROR_TYPES[429],
    status: 429,
    requestId: response.get('x-request-id'),
  });
}
