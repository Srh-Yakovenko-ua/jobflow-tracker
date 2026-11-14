import type { PushMessage } from '@jobflow/shared';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type PushSubscription,
  type RequestOptions,
  sendNotification,
  type VapidKeys,
  WebPushError,
} from 'web-push';

import { errorMessageOf } from '../../common/error-message.js';
import { DEPENDENCY_LIMITS, withinLimit } from '../../common/probe.js';
import type { Env } from '../../config/env.js';

export type PushTarget = Pick<PushSubscription, 'endpoint' | 'keys'>;

export type PushOutcome = 'sent' | 'gone' | 'failed';

export const PUSH_SENDER = { subject: 'mailto:push@jobflow.local', ttlSeconds: 86_400 } as const;

const GONE_STATUSES: ReadonlySet<number> = new Set([404, 410]);

export const pushOutcomeOf = (error: unknown): PushOutcome =>
  error instanceof WebPushError && GONE_STATUSES.has(error.statusCode) ? 'gone' : 'failed';

export function pushOptionsOf(keys: VapidKeys): RequestOptions {
  return {
    vapidDetails: { subject: PUSH_SENDER.subject, ...keys },
    TTL: PUSH_SENDER.ttlSeconds,
    timeout: DEPENDENCY_LIMITS.providerTimeoutMs,
  };
}

@Injectable()
export class PushSender {
  private readonly logger = new Logger(PushSender.name);

  private readonly keys: VapidKeys | undefined;

  constructor(config: ConfigService<Env, true>) {
    const publicKey = config.get('VAPID_PUBLIC_KEY', { infer: true });
    const privateKey = config.get('VAPID_PRIVATE_KEY', { infer: true });
    this.keys = publicKey && privateKey ? { publicKey, privateKey } : undefined;
  }

  get enabled(): boolean {
    return this.keys !== undefined;
  }

  get publicKey(): string | null {
    return this.keys?.publicKey ?? null;
  }

  async send(target: PushTarget, message: PushMessage): Promise<PushOutcome> {
    if (this.keys === undefined) return 'failed';
    try {
      const options = pushOptionsOf(this.keys);
      await withinLimit(
        sendNotification(target, JSON.stringify(message), options),
        DEPENDENCY_LIMITS.providerTimeoutMs,
      );
      return 'sent';
    } catch (error) {
      const outcome = pushOutcomeOf(error);
      this.logger.warn({ outcome, err: errorMessageOf(error) }, 'push not delivered');
      return outcome;
    }
  }
}
