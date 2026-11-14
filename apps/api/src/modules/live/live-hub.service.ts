import { LIVE_LIMITS, type LiveEvent, liveEventSchema } from '@jobflow/shared';
import { Injectable, Logger, type MessageEvent, type OnModuleDestroy } from '@nestjs/common';
import type { Redis } from 'ioredis';
import {
  defer,
  filter,
  finalize,
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

import { errorFor } from '../../common/app-error.js';
import { errorMessageOf } from '../../common/error-message.js';
import { parsedJson } from '../../common/parsed-json.js';
import { RedisService } from '../../redis/redis.service.js';
import type { AccessUser } from '../auth/index.js';
import { LIVE_CHANNEL } from './live-publisher.js';

export const LIVE_STREAM_LIMITS = { perUser: 5 } as const;

type ReceivedLiveEvent = { userId: string; event: LiveEvent };

const HEARTBEAT: MessageEvent = { comment: 'heartbeat' };

const STREAM_MAX_MS = LIVE_LIMITS.streamMaxSeconds * 1000;

function lifetimeMs(expiresAt: Date | undefined): number {
  return Math.min(STREAM_MAX_MS, (expiresAt?.getTime() ?? 0) - Date.now());
}

@Injectable()
export class LiveHub implements OnModuleDestroy {
  private readonly logger = new Logger(LiveHub.name);

  private readonly subscriber: Redis;

  private readonly received = new Subject<ReceivedLiveEvent>();

  private readonly closed = new Subject<void>();

  private readonly resubscribed = new Subject<void>();

  private subscriptionLost = false;

  private readonly openStreams = new Map<string, number>();

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
      this.subscriptionLost = true;
      this.closed.next();
    });
    this.subscriber.on('ready', () => void this.subscribe());
    this.subscriber.on('pmessage', (...[, channel, message]: [string, string, string]) => {
      this.receive(channel.slice(LIVE_CHANNEL.prefix.length), message);
    });
  }

  stream({ id: userId, token }: AccessUser): Observable<MessageEvent> {
    return defer(() => {
      this.claimStream(userId);
      const ended = merge(
        this.closed,
        timer(lifetimeMs(token?.expiresAt)),
        ...(this.subscriptionLost ? [this.resubscribed] : []),
      );
      return merge(this.eventsOf(userId), this.heartbeat).pipe(
        takeUntil(ended),
        finalize(() => {
          this.releaseStream(userId);
        }),
      );
    });
  }

  onModuleDestroy(): void {
    this.closed.next();
    this.subscriber.disconnect();
  }

  private eventsOf(userId: string): Observable<MessageEvent> {
    return this.received.pipe(
      filter((received) => received.userId === userId),
      map(({ event }): MessageEvent => ({ id: event.id, type: event.type, data: event.data })),
    );
  }

  private claimStream(userId: string): void {
    const open = this.openStreams.get(userId) ?? 0;
    if (open >= LIVE_STREAM_LIMITS.perUser) {
      throw errorFor(429, 'Too many open live streams');
    }
    this.openStreams.set(userId, open + 1);
  }

  private releaseStream(userId: string): void {
    const open = (this.openStreams.get(userId) ?? 1) - 1;
    if (open === 0) {
      this.openStreams.delete(userId);
      return;
    }
    this.openStreams.set(userId, open);
  }

  private async subscribe(): Promise<void> {
    try {
      await this.subscriber.psubscribe(LIVE_CHANNEL.pattern);
      this.endStreamsOpenedWithoutSubscription();
    } catch (error) {
      this.logger.warn({ err: errorMessageOf(error) }, 'live subscription failed');
    }
  }

  private endStreamsOpenedWithoutSubscription(): void {
    if (this.subscriptionLost) {
      this.subscriptionLost = false;
      this.resubscribed.next();
    }
  }

  private receive(userId: string, message: string): void {
    const event = parsedJson(liveEventSchema, message);
    if (event === undefined) {
      this.logger.warn({ userId }, 'live event dropped');
      return;
    }
    this.received.next({ userId, event });
  }

  private async endStreamsWhileRedisIsDown(): Promise<void> {
    if (!(await this.redis.isUp())) {
      this.closed.next();
    }
  }
}
