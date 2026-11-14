import type { ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';

import { errorFor } from '../common/app-error.js';
import { RATE_LIMIT_POLICIES, type RateLimitPolicy } from './rate-limit.policies.js';
import type { RateLimitService } from './rate-limit.service.js';

export type RateLimitCheck = { policy: RateLimitPolicy; context: ExecutionContext };

export async function enforceRateLimit(
  limits: Pick<RateLimitService, 'consume'>,
  { policy, context }: RateLimitCheck,
): Promise<void> {
  const http = context.switchToHttp();
  const key = RATE_LIMIT_POLICIES[policy].keyOf(http.getRequest<Request>());
  const outcome = await limits.consume(policy, key);
  if (outcome.limited) {
    http.getResponse<Response>().set('Retry-After', String(outcome.retryAfterSeconds));
    throw errorFor(429);
  }
}
