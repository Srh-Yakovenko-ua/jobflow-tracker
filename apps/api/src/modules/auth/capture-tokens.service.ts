import type { CaptureTokenCreated, CaptureTokenListResponse } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { notFound, unauthorized } from '../../common/app-error.js';
import type { AccessUser } from './access-tokens.js';
import { CaptureTokensRepository } from './capture-tokens.repository.js';
import { hashRefreshToken as hashToken, newRefreshToken as newToken } from './refresh-tokens.js';

@Injectable()
export class CaptureTokensService {
  constructor(private readonly repository: CaptureTokensRepository) {}

  async create(userId: string): Promise<CaptureTokenCreated> {
    const token = newToken();
    const { id, createdAt } = await this.repository.replace({
      userId,
      tokenHash: hashToken(token),
      now: new Date(),
    });
    return { id, token, createdAt: createdAt.toISOString() };
  }

  async list(userId: string): Promise<CaptureTokenListResponse> {
    const tokens = await this.repository.findActive(userId);
    return {
      items: tokens.map(({ id, createdAt, lastUsedAt }) => ({
        id,
        createdAt: createdAt.toISOString(),
        lastUsedAt: lastUsedAt?.toISOString() ?? null,
      })),
    };
  }

  async revoke(userId: string, id: string): Promise<void> {
    if ((await this.repository.revoke(userId, { id, now: new Date() })) === 0) {
      throw notFound('Capture token not found');
    }
  }

  async verify(token: string): Promise<AccessUser> {
    const used = await this.repository.use({ tokenHash: hashToken(token), now: new Date() });
    if (used === undefined) {
      throw unauthorized('Invalid capture token');
    }
    return { id: used.userId, scope: ['capture'], captureTokenId: used.id };
  }
}
