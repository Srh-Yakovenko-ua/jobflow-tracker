import { randomUUID } from 'node:crypto';

import { EXPORT_LIMITS, type ExportAccepted, type ExportLink } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { notFound } from '../../common/app-error.js';
import { Clock } from '../../common/clock.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { FileStorage } from '../../storage/file-storage.js';
import type { ExportRequested } from './account.events.js';
import { AccountRepository } from './account.repository.js';
import { EXPORT_MIME, exportFilename, exportKey } from './export-files.js';

export type ExportOrder = Omit<ExportRequested, 'exportId'>;

const ACCOUNT_NOT_FOUND = 'Account not found';

const EXPORT_NOT_FOUND = 'Export not found';

@Injectable()
export class AccountService {
  constructor(
    private readonly repository: AccountRepository,
    private readonly prisma: PrismaService,
    private readonly storage: FileStorage,
    private readonly clock: Clock,
  ) {}

  requestExport(userId: string, order: ExportOrder): Promise<ExportAccepted> {
    const exportId = randomUUID();
    return this.prisma.$transaction(async (tx) => {
      await this.repository.lockUser(userId, { tx });
      if (!(await this.repository.exists(userId, { tx }))) {
        throw notFound(ACCOUNT_NOT_FOUND);
      }
      await this.repository.recordExportRequested(userId, {
        requested: { exportId, ...order },
        tx,
      });
      return { exportId };
    });
  }

  async exportLink(userId: string, exportId: string): Promise<ExportLink> {
    const key = exportKey({ userId, exportId });
    if ((await this.storage.head(key)) === null) {
      return this.pendingExport(userId, exportId);
    }
    const signedAt = this.clock.now();
    const { url, expiresAt } = await this.storage.createDownloadUrl({
      key,
      mime: EXPORT_MIME,
      filename: exportFilename(signedAt),
      signedAt,
      ttlSeconds: EXPORT_LIMITS.linkTtlSeconds,
    });
    return { status: 'ready', url, expiresAt: expiresAt.toISOString() };
  }

  private async pendingExport(userId: string, exportId: string): Promise<ExportLink> {
    if ((await this.repository.latestExportId(userId)) !== exportId) {
      throw notFound(EXPORT_NOT_FOUND);
    }
    return { status: 'pending' };
  }
}
