import { Injectable, Logger } from '@nestjs/common';

import { addMinutes } from '../add-minutes.js';
import { conflict } from '../app-error.js';
import { Clock } from '../clock.js';
import {
  type IdempotencyKeyRow,
  IdempotencyRepository,
  type KeyClaim,
  type KeyReply,
} from './idempotency.repository.js';
import {
  type HandlerReply,
  IDEMPOTENCY_CONFLICTS,
  IDEMPOTENCY_LIMITS,
  type StoredReply,
  storedReplyOf,
  storedReplySchema,
} from './idempotency-request.js';

export type ClaimResult = { claimed: true } | { claimed: false; reply: StoredReply };

function replyOf(holder: IdempotencyKeyRow | null, requestHash: string): StoredReply {
  if (holder !== null && holder.requestHash !== requestHash) {
    throw conflict(IDEMPOTENCY_CONFLICTS.mismatch);
  }
  if (holder === null || holder.response === null) throw conflict(IDEMPOTENCY_CONFLICTS.inProgress);
  return storedReplySchema.parse(holder.response);
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(
    private readonly keys: IdempotencyRepository,
    private readonly clock: Clock,
  ) {}

  async claim(userId: string, { key, requestHash }: KeyClaim): Promise<ClaimResult> {
    const now = this.clock.now();
    const windowStart = addMinutes(now, -IDEMPOTENCY_LIMITS.replayWindowMinutes);
    const outcome = await this.keys.claim(userId, { key, requestHash, now, windowStart });
    if (outcome.claimed) return outcome;
    return { claimed: false, reply: replyOf(outcome.holder, requestHash) };
  }

  async complete(userId: string, { key, reply }: KeyReply<HandlerReply>): Promise<void> {
    try {
      await this.keys.complete(userId, { key, reply: storedReplyOf(reply) });
    } catch (error: unknown) {
      this.logger.warn({ err: error }, 'idempotency key not completed');
    }
  }

  async release(userId: string, key: string): Promise<void> {
    try {
      await this.keys.release(userId, key);
    } catch (error: unknown) {
      this.logger.warn({ err: error }, 'idempotency key not released');
    }
  }
}
