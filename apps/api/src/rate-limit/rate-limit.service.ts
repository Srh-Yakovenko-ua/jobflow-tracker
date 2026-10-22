import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  RateLimiterMemory,
  RateLimiterRedis,
  RateLimiterRes,
  RLWrapperTimeouts,
} from 'rate-limiter-flexible';

import { DEPENDENCY_LIMITS } from '../common/probe.js';
import type { Env } from '../config/env.js';
import { RedisService } from '../redis/redis.service.js';
import { RATE_LIMIT_POLICIES, type RateLimitPolicy } from './rate-limit.policies.js';

export type RateLimitOutcome = { limited: false } | { limited: true; retryAfterSeconds: number };

type LimiterInput = {
  redis: RedisService;
  config: ConfigService<Env, true>;
  policy: RateLimitPolicy;
};

function limiterFor({ redis, config, policy }: LimiterInput): RLWrapperTimeouts {
  const { envKey, durationSeconds } = RATE_LIMIT_POLICIES[policy];
  const window = { points: config.get(envKey, { infer: true }), duration: durationSeconds };
  return new RLWrapperTimeouts({
    limiter: new RateLimiterRedis({
      ...window,
      storeClient: redis.client,
      keyPrefix: `rate-limit:${policy}`,
    }),
    timeoutMs: DEPENDENCY_LIMITS.pingTimeoutMs,
    insuranceLimiter: new RateLimiterMemory(window),
  });
}

function retryAfterSeconds(rejection: RateLimiterRes): number {
  return Math.max(1, Math.ceil(rejection.msBeforeNext / 1000));
}

@Injectable()
export class RateLimitService {
  private readonly limiters: Record<RateLimitPolicy, RLWrapperTimeouts>;

  constructor(redis: RedisService, config: ConfigService<Env, true>) {
    const build = (policy: RateLimitPolicy) => limiterFor({ redis, config, policy });
    this.limiters = {
      login: build('login'),
      register: build('register'),
      ai: build('ai'),
      capture: build('capture'),
      api: build('api'),
    };
  }

  async consume(policy: RateLimitPolicy, key: string): Promise<RateLimitOutcome> {
    try {
      await this.limiters[policy].consume(key);
      return { limited: false };
    } catch (rejection) {
      if (rejection instanceof RateLimiterRes) {
        return { limited: true, retryAfterSeconds: retryAfterSeconds(rejection) };
      }
      throw rejection;
    }
  }
}
