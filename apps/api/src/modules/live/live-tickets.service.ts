import { createHash, randomBytes } from 'node:crypto';

import { LIVE_LIMITS, type LiveTicket } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { unauthorized } from '../../common/app-error.js';
import { parsedJson } from '../../common/parsed-json.js';
import { redisAnswered } from '../../common/probe.js';
import { RedisService } from '../../redis/redis.service.js';
import type { AccessUser } from '../auth/index.js';

const storedTicketSchema = z.object({
  userId: z.uuid(),
  token: z.object({ issuedAt: z.coerce.date(), expiresAt: z.coerce.date() }),
});

function ticketKey(ticket: string): string {
  return `events-ticket:${createHash('sha256').update(ticket).digest('hex')}`;
}

@Injectable()
export class LiveTicketsService {
  constructor(private readonly redis: RedisService) {}

  async issue({ id, token }: AccessUser): Promise<LiveTicket> {
    if (token === undefined) {
      throw unauthorized();
    }
    const ticket = randomBytes(32).toString('base64url');
    const expiresInSeconds = LIVE_LIMITS.ticketTtlSeconds;
    const stored = JSON.stringify({ userId: id, token });
    await redisAnswered(
      this.redis.client.set(ticketKey(ticket), stored, 'EX', expiresInSeconds, 'NX'),
    );
    return { ticket, expiresInSeconds };
  }

  async redeem(ticket: string): Promise<AccessUser | null> {
    const stored = await redisAnswered(this.redis.client.getdel(ticketKey(ticket)));
    const redeemed = stored === null ? undefined : parsedJson(storedTicketSchema, stored);
    return redeemed === undefined
      ? null
      : { id: redeemed.userId, scope: [], token: redeemed.token };
  }
}
