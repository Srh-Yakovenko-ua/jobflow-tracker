import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';

export type NewCaptureToken = { userId: string; tokenHash: string; now: Date };

export type UsedCaptureToken = { tokenHash: string; now: Date };

export type RevokedCaptureToken = { id: string; now: Date };

export type CreatedCaptureToken = { id: string; createdAt: Date };

export type CaptureTokenOwner = { id: string; userId: string };

@Injectable()
export class CaptureTokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  replace({ userId, tokenHash, now }: NewCaptureToken): Promise<CreatedCaptureToken> {
    return this.prisma.$transaction(async (tx) => {
      await tx.captureToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      });
      return tx.captureToken.create({
        data: { userId, tokenHash },
        select: { id: true, createdAt: true },
      });
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
