import { Injectable } from '@nestjs/common';

import { errorFor } from '../../common/app-error.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RedisService } from '../../redis/redis.service.js';

export type Health = { status: 'ok' };

export type Readiness = Health & { checks: { redis: 'up'; postgres: 'up' } };

@Injectable()
export class HealthService {
  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  liveness(): Health {
    return { status: 'ok' };
  }

  async readiness(): Promise<Readiness> {
    const [redisUp, postgresUp] = await Promise.all([this.redis.isUp(), this.prisma.isUp()]);
    if (!redisUp) {
      throw errorFor(503, 'Redis is not reachable');
    }
    if (!postgresUp) {
      throw errorFor(503, 'Postgres is not reachable');
    }
    return { status: 'ok', checks: { redis: 'up', postgres: 'up' } };
  }
}
