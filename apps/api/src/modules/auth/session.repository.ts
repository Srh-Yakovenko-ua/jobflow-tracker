import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export type NewRefreshToken = {
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
};

export type RotateInput = {
  tokenHash: string;
  next: Pick<NewRefreshToken, 'tokenHash' | 'expiresAt'>;
  now: Date;
};

export type TokenFamily = { userId: string; familyId: string };

export type RotateOutcome =
  | { status: 'rotated'; userId: string }
  | ({ status: 'reused' } & TokenFamily)
  | { status: 'invalid' };

export type UserAt = { userId: string; now: Date };

export type OwnedToken = { userId: string; tokenHash: string };

const INVALID: RotateOutcome = { status: 'invalid' };

const PRESENTED_SELECT = { id: true, userId: true, familyId: true, expiresAt: true } as const;

function revokeFamily(tx: Prisma.TransactionClient, family: TokenFamily & { now: Date }) {
  return tx.refreshToken.updateMany({
    where: { userId: family.userId, familyId: family.familyId, revokedAt: null },
    data: { revokedAt: family.now },
  });
}

@Injectable()
export class SessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async insert(token: NewRefreshToken): Promise<void> {
    await this.prisma.refreshToken.create({ data: token, select: { id: true } });
  }

  rotate({ tokenHash, next, now }: RotateInput): Promise<RotateOutcome> {
    return this.prisma.$transaction(async (tx) => {
      const presented = await tx.refreshToken.findUnique({
        where: { tokenHash },
        select: PRESENTED_SELECT,
      });
      if (presented === null || presented.expiresAt <= now) {
        return INVALID;
      }
      const { userId, familyId } = presented;
      const { count } = await tx.refreshToken.updateMany({
        where: { id: presented.id, revokedAt: null },
        data: { revokedAt: now },
      });
      if (count === 0) {
        await revokeFamily(tx, { userId, familyId, now });
        return { status: 'reused', userId, familyId };
      }
      await tx.refreshToken.create({ data: { userId, familyId, ...next }, select: { id: true } });
      return { status: 'rotated', userId };
    });
  }

  async revokeFamilyOf(tokenHash: string, now: Date): Promise<void> {
    const presented = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: { userId: true, familyId: true },
    });
    if (presented !== null) {
      await revokeFamily(this.prisma, { ...presented, now });
    }
  }

  async revokeAll({ userId, now }: UserAt): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  async familyOf({ userId, tokenHash }: OwnedToken): Promise<string | undefined> {
    const token = await this.prisma.refreshToken.findFirst({
      where: { userId, tokenHash, revokedAt: null },
      select: { familyId: true },
    });
    return token?.familyId;
  }
}
