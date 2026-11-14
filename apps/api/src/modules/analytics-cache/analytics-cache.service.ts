import { analyticsVersionKey } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { DEPENDENCY_LIMITS, withinLimit } from '../../common/probe.js';
import { RedisService } from '../../redis/redis.service.js';

@Injectable()
export class AnalyticsCacheService {
  constructor(private readonly redis: RedisService) {}

  async invalidate(userId: string): Promise<void> {
    const bumped = this.redis.client.incr(analyticsVersionKey(userId));
    await withinLimit(bumped, DEPENDENCY_LIMITS.pingTimeoutMs);
  }
}
