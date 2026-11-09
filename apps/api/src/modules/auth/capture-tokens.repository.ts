import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { UserAt } from './session.repository.js';

export type NewCaptureToken = { userId: string; tokenHash: string; now: Date };

export type UsedCaptureToken = { tokenHash: string; now: Date };

export type RevokedCaptureToken = { id: string; now: Date };

export type CreatedCaptureToken = { id: string; createdAt: Date };

export type ActiveCaptureToken = CreatedCaptureToken & { lastUsedAt: Date | null };

export type CaptureTokenOwner = { id: string; userId: string };

@Injectable()
export class CaptureTokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActive(userId: string): Promise<ActiveCaptureToken[]> {
    return this.prisma.captureToken.findMany({
      where: { userId, revokedAt: null },
      select: { id: true, createdAt: true, lastUsedAt: true },
      orderBy: { id: 'desc' },
    });
  }

  replace({ userId, tokenHash, now }: NewCaptureToken): Promise<CreatedCaptureToken> {
    return this.prisma.$transaction(async (tx) => {
      await this.revokeAll({ userId, now }, tx);
      return tx.captureToken.create({
        data: { userId, tokenHash },
        select: { id: true, createdAt: true },
      });
    });
  }

  async revokeAll({ userId, now }: UserAt, client: Prisma.TransactionClient): Promise<void> {
    await client.captureToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  async revoke(userId: string, { id, now }: RevokedCaptureToken): Promise<number> {
    const { count } = await this.prisma.captureToken.updateMany({
      where: { id, userId, revokedAt: null },
      data: { revokedAt: now },
    });
    return count;
  }

  async use({ tokenHash, now }: UsedCaptureToken): Promise<CaptureTokenOwner | undefined> {
    const [token] = await this.prisma.captureToken.updateManyAndReturn({
      where: { tokenHash, revokedAt: null },
      data: { lastUsedAt: now },
      select: { id: true, userId: true },
    });
    return token;
  }
}
