import type { DeleteAccountInput } from '@jobflow/shared';
import { Injectable, Logger } from '@nestjs/common';

import { errorMessageOf } from '../../common/error-message.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { FileStorage } from '../../storage/file-storage.js';
import { AuthService } from '../auth/index.js';
import { AccountRepository } from './account.repository.js';
import { exportsPrefix, userObjectsPrefix } from './export-files.js';

const userObjectPrefixes = (userId: string) => [
  userObjectsPrefix(userId),
  `pending/${userObjectsPrefix(userId)}`,
];

@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    private readonly auth: AuthService,
    private readonly storage: FileStorage,
    private readonly repository: AccountRepository,
    private readonly prisma: PrismaService,
  ) {}

  async delete(userId: string, { password }: DeleteAccountInput): Promise<void> {
    await this.auth.confirmAccount({ userId, password });
    for (const prefix of userObjectPrefixes(userId)) {
      await this.storage.deletePrefix(prefix);
    }
    await this.prisma.$transaction(async (tx) => {
      await this.repository.lockUser(userId, { tx });
      await this.repository.deleteOutboxOf(userId, { tx });
      await this.repository.deleteUser(userId, { tx });
    });
    await this.purgeLateExports(userId);
  }

  private async purgeLateExports(userId: string): Promise<void> {
    try {
      await this.storage.deletePrefix(exportsPrefix(userId));
    } catch (error) {
      const err = errorMessageOf(error);
      this.logger.warn({ userId, err }, 'exports not purged after the account deletion');
    }
  }
}
