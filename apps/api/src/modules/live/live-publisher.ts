import { randomUUID } from 'node:crypto';

import type { LiveEvent } from '@jobflow/shared';
import { Injectable, Logger } from '@nestjs/common';

import { DEPENDENCY_LIMITS, withinLimit } from '../../common/probe.js';
import { RedisService } from '../../redis/redis.service.js';

type WithoutId<Event> = Event extends unknown ? Omit<Event, 'id'> : never;

export type LiveEventBody = WithoutId<LiveEvent>;

export const LIVE_CHANNEL = { prefix: 'user:', pattern: 'user:*' } as const;

@Injectable()
export class LivePublisher {
  private readonly logger = new Logger(LivePublisher.name);

  constructor(private readonly redis: RedisService) {}

  async publish(userId: string, event: LiveEventBody): Promise<void> {
    const message = JSON.stringify({ id: randomUUID(), ...event });
    try {
      const published = this.redis.client.publish(`${LIVE_CHANNEL.prefix}${userId}`, message);
      await withinLimit(published, DEPENDENCY_LIMITS.pingTimeoutMs);
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      this.logger.warn({ userId, type: event.type, err }, 'live event not published');
    }
  }
}
