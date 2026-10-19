import { setTimeout as delay } from 'node:timers/promises';

import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

import type { Env } from '../config/env.js';

const REDIS_LIMITS = { connectTimeoutMs: 2000, pingTimeoutMs: 1000 } as const;

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  private readonly logger = new Logger(RedisService.name);

  constructor(config: ConfigService<Env, true>) {
    this.client = new Redis(config.get('REDIS_URL', { infer: true }), {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: REDIS_LIMITS.connectTimeoutMs,
    });
    this.client.on('error', (error: Error) => {
      this.logger.warn(`Redis connection error: ${error.message}`);
    });
  }

  async isUp(): Promise<boolean> {
    const ping = this.client.ping().then(
      () => true,
      () => false,
    );
    return Promise.race([ping, delay(REDIS_LIMITS.pingTimeoutMs, false, { ref: false })]);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.status === 'end') {
      return;
    }
    if (this.client.status === 'reconnecting') {
      this.client.disconnect();
      return;
    }
    const ended = new Promise<void>((resolve) => this.client.once('end', resolve));
    await this.client.quit().catch(() => {
      this.client.disconnect();
    });
    await ended;
  }
}
