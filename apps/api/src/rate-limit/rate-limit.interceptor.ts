import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';

import { errorFor } from '../common/app-error.js';
import { RATE_LIMIT_POLICY } from './rate-limit.decorator.js';
import {
  DEFAULT_RATE_LIMIT_POLICY,
  RATE_LIMIT_POLICIES,
  type RateLimitPolicy,
} from './rate-limit.policies.js';
import { RateLimitService } from './rate-limit.service.js';

@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  constructor(
    private readonly limits: RateLimitService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const policy = this.policyOf(context);
    const http = context.switchToHttp();
    const key = RATE_LIMIT_POLICIES[policy].keyOf(http.getRequest<Request>());
    const outcome = await this.limits.consume(policy, key);
    if (outcome.limited) {
      http.getResponse<Response>().set('Retry-After', String(outcome.retryAfterSeconds));
      throw errorFor(429);
    }
    return next.handle();
  }

  private policyOf(context: ExecutionContext): RateLimitPolicy {
    const targets = [context.getHandler(), context.getClass()];
    return (
      this.reflector.getAllAndOverride<RateLimitPolicy | undefined>(RATE_LIMIT_POLICY, targets) ??
      DEFAULT_RATE_LIMIT_POLICY
    );
  }
}
