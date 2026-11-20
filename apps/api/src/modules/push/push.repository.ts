import type { PushSubscriptionInput } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export type SavePushSubscription = PushSubscriptionInput & { userAgent: string | null; now: Date };

export type DeliveredPush = { id: string; now: Date };

export const PUSH_TARGET_SELECT = {
  id: true,
  endpoint: true,
  p256dh: true,
  auth: true,
} satisfies Prisma.PushSubscriptionSelect;

export type PushTargetRow = Prisma.PushSubscriptionGetPayload<{
  select: typeof PUSH_TARGET_SELECT;
}>;

@Injectable()
export class PushRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(
    userId: string,
    { endpoint, keys, userAgent, now }: SavePushSubscription,
  ): Promise<string> {
    const owned = { userId, p256dh: keys.p256dh, auth: keys.auth, userAgent, createdAt: now };
    const { id } = await this.prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { ...owned, endpoint },
      update: { ...owned, failedCount: 0 },
      select: { id: true },
    });
    return id;
  }

  async remove(userId: string, id: string): Promise<number> {
    const { count } = await this.prisma.pushSubscription.deleteMany({ where: { id, userId } });
    return count;
  }

  async keepLatest(userId: string, { keep }: { keep: number }): Promise<void> {
    await this.prisma.$executeRaw`
      DELETE FROM push_subscriptions
      WHERE user_id = ${userId}::uuid AND id NOT IN (
        SELECT id FROM push_subscriptions WHERE user_id = ${userId}::uuid
        ORDER BY created_at DESC, id DESC LIMIT ${keep}
      )`;
  }

  listForUser(userId: string): Promise<PushTargetRow[]> {
    return this.prisma.pushSubscription.findMany({
      where: { userId },
      orderBy: { id: 'asc' },
      select: PUSH_TARGET_SELECT,
    });
  }

  async markDelivered(userId: string, { id, now }: DeliveredPush): Promise<void> {
    await this.prisma.pushSubscription.updateMany({
      where: { id, userId },
      data: { lastSuccessAt: now, failedCount: 0 },
    });
  }

  async recordFailure(userId: string, id: string): Promise<number | null> {
    const [counted] = await this.prisma.pushSubscription.updateManyAndReturn({
      where: { id, userId },
      data: { failedCount: { increment: 1 } },
      select: { failedCount: true },
    });
    return counted?.failedCount ?? null;
  }
}
