import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { SSE_METADATA } from '@nestjs/common/constants.js';
import { Reflector } from '@nestjs/core';
import type { Observable } from 'rxjs';

import { enforceRateLimit } from './enforce-rate-limit.js';
import { RATE_LIMIT_POLICY } from './rate-limit.decorator.js';
import { DEFAULT_RATE_LIMIT_POLICY, type RateLimitPolicy } from './rate-limit.policies.js';
import { RateLimitService } from './rate-limit.service.js';

@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  constructor(
    private readonly limits: RateLimitService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (!this.isEventStream(context)) {
      await enforceRateLimit(this.limits, { policy: this.policyOf(context), context });
    }
    return next.handle();
  }

  private isEventStream(context: ExecutionContext): boolean {
    return this.reflector.get<boolean | undefined>(SSE_METADATA, context.getHandler()) === true;
  }

  private policyOf(context: ExecutionContext): RateLimitPolicy {
    const targets = [context.getHandler(), context.getClass()];
    return (
      this.reflector.getAllAndOverride<RateLimitPolicy | undefined>(RATE_LIMIT_POLICY, targets) ??
      DEFAULT_RATE_LIMIT_POLICY
    );
  }
}
