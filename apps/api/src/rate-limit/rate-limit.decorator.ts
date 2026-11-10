import { SetMetadata } from '@nestjs/common';

import type { RouteRateLimit } from './rate-limit.policies.js';

export const RATE_LIMIT_POLICY = 'rateLimitPolicy';

export const RateLimit = (policy: RouteRateLimit) => SetMetadata(RATE_LIMIT_POLICY, policy);
