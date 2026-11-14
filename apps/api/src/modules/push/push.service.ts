import {
  PUSH_LIMITS,
  type PushPublicKey,
  type PushSubscriptionCreated,
  type PushSubscriptionInput,
} from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { notFound } from '../../common/app-error.js';
import { PushRepository } from './push.repository.js';
import { PushSender } from './push-sender.js';

export type NewPushSubscription = {
  input: PushSubscriptionInput;
  userAgent: string | undefined;
};

@Injectable()
export class PushService {
  constructor(
    private readonly repository: PushRepository,
    private readonly sender: PushSender,
  ) {}

  publicKey(): PushPublicKey {
    return { publicKey: this.sender.publicKey };
  }

  async subscribe(
    userId: string,
    { input, userAgent }: NewPushSubscription,
  ): Promise<PushSubscriptionCreated> {
    const cut = userAgent?.slice(0, PUSH_LIMITS.userAgentMax) ?? null;
    return { id: await this.repository.upsert(userId, { ...input, userAgent: cut }) };
  }

  async remove(userId: string, id: string): Promise<void> {
    if ((await this.repository.remove(userId, id)) === 0) {
      throw notFound('Push subscription not found');
    }
  }
}
