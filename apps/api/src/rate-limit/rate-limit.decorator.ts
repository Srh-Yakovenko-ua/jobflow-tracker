import { SetMetadata } from '@nestjs/common';

import type { RateLimitPolicy } from './rate-limit.policies.js';

export const RATE_LIMIT_POLICY = 'rateLimitPolicy';

export const RateLimit = (policy: RateLimitPolicy) => SetMetadata(RATE_LIMIT_POLICY, policy);
