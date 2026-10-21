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

export type RevokeAllInput = UserAt & { keepFamilyId?: string | undefined };

export type OwnedToken = { userId: string; tokenHash: string };

const INVALID: RotateOutcome = { status: 'invalid' };

const PRESENTED_SELECT = { id: true, userId: true, familyId: true, expiresAt: true } as const;

type Revocation = { where: Prisma.RefreshTokenWhereInput; now: Date };

function revoke(client: Prisma.TransactionClient, { where, now }: Revocation) {
  return client.refreshToken.updateMany({
    where: { ...where, revokedAt: null },
    data: { revokedAt: now },
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
      const { count } = await revoke(tx, { where: { id: presented.id }, now });
      if (count === 0) {
        await revoke(tx, { where: { userId, familyId }, now });
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
      await revoke(this.prisma, { where: presented, now });
    }
  }

  async revokeAll(
    { userId, now, keepFamilyId }: RevokeAllInput,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const otherFamilies = keepFamilyId === undefined ? {} : { familyId: { not: keepFamilyId } };
    await revoke(client, { where: { userId, ...otherFamilies }, now });
  }

  async familyOf({ userId, tokenHash }: OwnedToken): Promise<string | undefined> {
    const token = await this.prisma.refreshToken.findFirst({
      where: { userId, tokenHash, revokedAt: null },
      select: { familyId: true },
    });
    return token?.familyId;
  }
}
