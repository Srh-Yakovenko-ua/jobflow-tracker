import { PUSH_LIMITS } from '@jobflow/shared';
import { Injectable, Logger } from '@nestjs/common';

import { Clock } from '../../common/clock.js';
import { SettingsService } from '../settings/index.js';
import { PushRepository, type PushTargetRow } from './push.repository.js';
import type { PushSendJob } from './push-jobs.js';
import { type PushOutcome, PushSender } from './push-sender.js';

type SettledPush = { userId: string; subscription: PushTargetRow; outcome: PushOutcome };

@Injectable()
export class PushSendService {
  private readonly logger = new Logger(PushSendService.name);

  constructor(
    private readonly repository: PushRepository,
    private readonly sender: PushSender,
    private readonly settings: SettingsService,
    private readonly clock: Clock,
  ) {}

  async send({ userId, message }: PushSendJob): Promise<PushOutcome[]> {
    if (!this.sender.enabled) return [];
    const subscriptions = await this.repository.listForUser(userId);
    if (subscriptions.length === 0) return [];
    if (!(await this.settings.get(userId)).notifyPush) return [];
    return Promise.all(
      subscriptions.map(async (subscription) => {
        const { endpoint, p256dh, auth } = subscription;
        const outcome = await this.sender.send({ endpoint, keys: { p256dh, auth } }, message);
        await this.settle({ userId, subscription, outcome }).catch((error: unknown) => {
          this.logger.warn({ outcome, err: error }, 'push outcome not saved');
        });
        return outcome;
      }),
    );
  }

  private async settle({ userId, subscription: { id }, outcome }: SettledPush): Promise<void> {
    const settled: Record<PushOutcome, () => Promise<unknown>> = {
      sent: () => this.repository.markDelivered(userId, { id, now: this.clock.now() }),
      gone: () => this.repository.remove(userId, id),
      failed: () => this.recordFailure(userId, id),
    };
    await settled[outcome]();
  }

  private async recordFailure(userId: string, id: string): Promise<void> {
    const failedCount = await this.repository.recordFailure(userId, id);
    if (failedCount !== null && failedCount >= PUSH_LIMITS.failedSendsMax) {
      await this.repository.remove(userId, id);
    }
  }
}
