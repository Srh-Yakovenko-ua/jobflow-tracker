import { pushMessageSchema } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { Clock } from '../../common/clock.js';
import { PushRepository, type PushTargetRow } from './push.repository.js';
import { type PushOutcome, PushSender } from './push-sender.js';

export const PUSH_JOBS = { send: 'push.send' } as const;

export const pushSendJobSchema = z.object({ userId: z.uuid(), message: pushMessageSchema });

export type PushSendJob = z.infer<typeof pushSendJobSchema>;

type SettledPush = { userId: string; subscription: PushTargetRow; outcome: PushOutcome };

@Injectable()
export class PushSendService {
  constructor(
    private readonly repository: PushRepository,
    private readonly sender: PushSender,
    private readonly clock: Clock,
  ) {}

  async send({ userId, message }: PushSendJob): Promise<PushOutcome[]> {
    const subscriptions = await this.repository.listForUser(userId);
    return Promise.all(
      subscriptions.map(async (subscription) => {
        const { endpoint, p256dh, auth } = subscription;
        const outcome = await this.sender.send({ endpoint, keys: { p256dh, auth } }, message);
        await this.settle({ userId, subscription, outcome });
        return outcome;
      }),
    );
  }

  private async settle({ userId, subscription: { id }, outcome }: SettledPush): Promise<void> {
    const settled: Record<PushOutcome, () => Promise<unknown>> = {
      sent: () => this.repository.markDelivered(userId, { id, now: this.clock.now() }),
      gone: () => this.repository.remove(userId, id),
      failed: () => this.repository.countFailure(userId, id),
    };
    await settled[outcome]();
  }
}
