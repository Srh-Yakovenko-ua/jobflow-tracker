import { randomUUID } from 'node:crypto';

import type { RefreshToken, SessionTokens } from '@jobflow/shared';
import { Injectable, Logger } from '@nestjs/common';

import { unauthorized } from '../../common/app-error.js';
import { AccessTokens } from './access-tokens.js';
import { AuthClock } from './auth-clock.js';
import { hashRefreshToken, newRefreshToken, refreshExpiryFrom } from './refresh-tokens.js';
import { SessionRepository } from './session.repository.js';
import { UserTokens } from './user-tokens.service.js';

export type IssuedSession = SessionTokens & { refreshToken: RefreshToken };

export type PresentedToken = { userId: string; refreshToken: string | undefined };

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly repository: SessionRepository,
    private readonly accessTokens: AccessTokens,
    private readonly tokens: UserTokens,
    private readonly clock: AuthClock,
  ) {}

  async start(userId: string): Promise<IssuedSession> {
    const now = this.clock.now();
    const refreshToken = newRefreshToken();
    await this.repository.insert({
      userId,
      familyId: randomUUID(),
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshExpiryFrom(now),
    });
    return { accessToken: await this.accessTokens.sign(userId, now), refreshToken };
  }

  async refresh(presented: string | undefined): Promise<IssuedSession> {
    if (presented === undefined) {
      throw unauthorized('Invalid refresh token');
    }
    const now = this.clock.now();
    const refreshToken = newRefreshToken();
    const outcome = await this.repository.rotate({
      tokenHash: hashRefreshToken(presented),
      next: { tokenHash: hashRefreshToken(refreshToken), expiresAt: refreshExpiryFrom(now) },
      now,
    });
    if (outcome.status === 'reused') {
      const { userId, familyId } = outcome;
      this.logger.warn({ userId, familyId }, 'refresh token reuse, family revoked');
    }
    if (outcome.status !== 'rotated') {
      throw unauthorized('Invalid refresh token');
    }
    return { accessToken: await this.accessTokens.sign(outcome.userId, now), refreshToken };
  }

  async logout(presented: string | undefined): Promise<void> {
    if (presented !== undefined) {
      await this.repository.revokeFamilyOf(hashRefreshToken(presented), this.clock.now());
    }
  }

  async logoutAll(userId: string): Promise<void> {
    await this.tokens.revokeEverywhere(userId);
  }

  async familyOf({ userId, refreshToken }: PresentedToken): Promise<string | undefined> {
    if (refreshToken === undefined) {
      return undefined;
    }
    return this.repository.familyOf({ userId, tokenHash: hashRefreshToken(refreshToken) });
  }
}
