import { liveStreamQuerySchema } from '@jobflow/shared';
import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { unauthorized } from '../../common/app-error.js';
import { enforceRateLimit } from '../../rate-limit/enforce-rate-limit.js';
import { DEFAULT_RATE_LIMIT_POLICY } from '../../rate-limit/rate-limit.policies.js';
import { RateLimitService } from '../../rate-limit/rate-limit.service.js';
import { LiveTicketsService } from './live-tickets.service.js';

@Injectable()
export class LiveTicketGuard implements CanActivate {
  constructor(
    private readonly tickets: LiveTicketsService,
    private readonly limits: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const ticket = liveStreamQuerySchema.safeParse(req.query).data?.ticket ?? '';
    const user = ticket === '' ? null : await this.tickets.redeem(ticket);
    if (user === null) {
      throw unauthorized('Invalid live ticket');
    }
    req.user = user;
    await enforceRateLimit(this.limits, { policy: DEFAULT_RATE_LIMIT_POLICY, context });
    return true;
  }
}
