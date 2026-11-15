import { applyDecorators, HttpCode, SetMetadata } from '@nestjs/common';

import { Idempotent } from '../common/idempotency/idempotent.decorator.js';
import type { RateLimitPolicy } from './rate-limit.policies.js';

export const RATE_LIMIT_POLICY = 'rateLimitPolicy';

export const RateLimit = (policy: RateLimitPolicy) => SetMetadata(RATE_LIMIT_POLICY, policy);

export const AcceptsAiJob = () => applyDecorators(HttpCode(202), RateLimit('ai'), Idempotent());
