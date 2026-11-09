import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import { CaptureTokensRepository } from './capture-tokens.repository.js';
import { type RevokeAllInput, SessionRepository } from './session.repository.js';

@Injectable()
export class UserTokens {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly captureTokens: CaptureTokensRepository,
  ) {}

  async revokeAll(input: RevokeAllInput, tx: Prisma.TransactionClient): Promise<void> {
    await this.sessions.revokeAll(input, tx);
    await this.captureTokens.revokeAll({ userId: input.userId, now: input.now }, tx);
  }
}
