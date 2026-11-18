import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuthClock } from './auth-clock.js';
import { CaptureTokensRepository } from './capture-tokens.repository.js';
import { type RevokeAllInput, SessionRepository } from './session.repository.js';

export type RevokeUserTokens = Omit<RevokeAllInput, 'now'>;

@Injectable()
export class UserTokens {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly captureTokens: CaptureTokensRepository,
    private readonly prisma: PrismaService,
    private readonly clock: AuthClock,
  ) {}

  async revokeAll(input: RevokeUserTokens, tx: Prisma.TransactionClient): Promise<void> {
    const now = this.clock.now();
    await this.sessions.revokeAll({ ...input, now }, tx);
    await this.captureTokens.revokeAll({ userId: input.userId, now }, tx);
  }

  async revokeEverywhere(userId: string): Promise<void> {
    await this.prisma.$transaction((tx) => this.revokeAll({ userId }, tx));
  }
}
