import { liveStreamQuerySchema } from '@jobflow/shared';
import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { unauthorized } from '../../common/app-error.js';
import { LiveTicketsService } from './live-tickets.service.js';

@Injectable()
export class LiveTicketGuard implements CanActivate {
  constructor(private readonly tickets: LiveTicketsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const ticket = liveStreamQuerySchema.safeParse(req.query).data?.ticket ?? '';
    const userId = ticket === '' ? null : await this.tickets.redeem(ticket);
    if (userId === null) {
      throw unauthorized('Invalid live ticket');
    }
    req.user = { id: userId, scope: [] };
    return true;
  }
}
