import { Injectable } from '@nestjs/common';

import { errorFor } from '../../common/app-error.js';
import { RedisService } from '../../redis/redis.service.js';

export type Health = { status: 'ok' };

export type Readiness = Health & { checks: { redis: 'up' } };

@Injectable()
export class HealthService {
  constructor(private readonly redis: RedisService) {}

  liveness(): Health {
    return { status: 'ok' };
  }

  async readiness(): Promise<Readiness> {
    if (!(await this.redis.isUp())) {
      throw errorFor(503, 'Redis is not reachable');
    }
    return { status: 'ok', checks: { redis: 'up' } };
  }
}
