import { createHash, randomBytes } from 'node:crypto';

import { LIVE_LIMITS, type LiveTicket } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { errorFor } from '../../common/app-error.js';
import { DEPENDENCY_LIMITS, withinLimit } from '../../common/probe.js';
import { RedisService } from '../../redis/redis.service.js';

function ticketKey(ticket: string): string {
  return `events-ticket:${createHash('sha256').update(ticket).digest('hex')}`;
}

@Injectable()
export class LiveTicketsService {
  constructor(private readonly redis: RedisService) {}

  async issue(userId: string): Promise<LiveTicket> {
    const ticket = randomBytes(32).toString('base64url');
    const expiresInSeconds = LIVE_LIMITS.ticketTtlSeconds;
    await this.answered(
      this.redis.client.set(ticketKey(ticket), userId, 'EX', expiresInSeconds, 'NX'),
    );
    return { ticket, expiresInSeconds };
  }

  redeem(ticket: string): Promise<string | null> {
    return this.answered(this.redis.client.getdel(ticketKey(ticket)));
  }

  private async answered<Reply>(call: Promise<Reply>): Promise<Reply> {
    try {
      return await withinLimit(call, DEPENDENCY_LIMITS.pingTimeoutMs);
    } catch {
      throw errorFor(503, 'Redis is not reachable');
    }
  }
}
