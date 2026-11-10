import { LIVE_LIMITS, type LiveEvent, liveEventSchema } from '@jobflow/shared';
import { Injectable, Logger, type MessageEvent, type OnModuleDestroy } from '@nestjs/common';
import type { Redis } from 'ioredis';
import {
  filter,
  interval,
  map,
  merge,
  type Observable,
  share,
  Subject,
  takeUntil,
  tap,
  timer,
} from 'rxjs';

import { RedisService } from '../../redis/redis.service.js';
import { LIVE_CHANNEL } from './live-publisher.js';

type ReceivedLiveEvent = { userId: string; event: LiveEvent };

const HEARTBEAT: MessageEvent = { comment: 'heartbeat' };

function parsedEvent(message: string) {
  try {
    return liveEventSchema.safeParse(JSON.parse(message));
  } catch {
    return undefined;
  }
}

@Injectable()
export class LiveHub implements OnModuleDestroy {
  private readonly logger = new Logger(LiveHub.name);

  private readonly subscriber: Redis;

  private readonly received = new Subject<ReceivedLiveEvent>();

  private readonly closed = new Subject<void>();

  private readonly heartbeat = interval(LIVE_LIMITS.heartbeatSeconds * 1000).pipe(
    tap(() => void this.endStreamsWhileRedisIsDown()),
    map(() => HEARTBEAT),
    share(),
  );

  constructor(private readonly redis: RedisService) {
    this.subscriber = redis.client.duplicate();
    this.subscriber.on('error', (error: Error) => {
      this.logger.warn({ err: error.message }, 'live subscriber connection error');
    });
    this.subscriber.on('close', () => {
      this.closed.next();
    });
    this.subscriber.on('ready', () => void this.subscribe());
    this.subscriber.on('pmessage', (...[, channel, message]: [string, string, string]) => {
      this.receive(channel.slice(LIVE_CHANNEL.prefix.length), message);
    });
  }

  stream(userId: string): Observable<MessageEvent> {
    const events = this.received.pipe(
      filter((received) => received.userId === userId),
      map(({ event }): MessageEvent => ({ id: event.id, type: event.type, data: event.data })),
    );
    const ended = merge(this.closed, timer(LIVE_LIMITS.streamMaxSeconds * 1000));
    return merge(events, this.heartbeat).pipe(takeUntil(ended));
  }

  onModuleDestroy(): void {
    this.closed.next();
    this.subscriber.disconnect();
  }

  private async subscribe(): Promise<void> {
    try {
      await this.subscriber.psubscribe(LIVE_CHANNEL.pattern);
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      this.logger.warn({ err }, 'live subscription failed');
    }
  }

  private receive(userId: string, message: string): void {
    const parsed = parsedEvent(message);
    if (parsed?.success !== true) {
      this.logger.warn({ userId }, 'live event dropped');
      return;
    }
    this.received.next({ userId, event: parsed.data });
  }

  private async endStreamsWhileRedisIsDown(): Promise<void> {
    if (!(await this.redis.isUp())) {
      this.closed.next();
    }
  }
}
