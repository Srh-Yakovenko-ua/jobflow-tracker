import { Injectable, Logger } from '@nestjs/common';

import { FileStorage } from '../../storage/file-storage.js';
import { NotificationsService } from '../notifications/index.js';
import type { ExportRequestedPayload } from './account.events.js';
import { AccountExportRepository } from './account-export.repository.js';
import { EXPORT_MIME, exportKey, exportsPrefix, exportZipOf } from './export-files.js';
import { exportTablesOf } from './export-tables.js';

@Injectable()
export class AccountExportService {
  private readonly logger = new Logger(AccountExportService.name);

  constructor(
    private readonly repository: AccountExportRepository,
    private readonly storage: FileStorage,
    private readonly notifications: NotificationsService,
  ) {}

  async build({ userId, exportId, format, requestId }: ExportRequestedPayload): Promise<void> {
    const data = await this.repository.findExportData(userId);
    if (data === null) {
      this.logger.log({ exportId, requestId }, 'export skipped: the account is gone');
      return;
    }
    const bytes = exportZipOf({ tables: exportTablesOf(data), format });
    const key = exportKey({ userId, exportId });
    await this.storage.deletePrefix(exportsPrefix(userId));
    await this.storage.put({ key, bytes, mime: EXPORT_MIME });
    if (!(await this.repository.accountExists(userId))) {
      await this.storage.delete(key);
      this.logger.log({ exportId, requestId }, 'export removed: the account is gone');
      return;
    }
    await this.notifications.recordOnce(userId, {
      type: 'export_ready',
      payload: { exportId, format },
    });
    this.logger.log(
      {
        exportId,
        requestId,
        format,
        applications: data.applications.length,
        sizeBytes: bytes.length,
      },
      'export built',
    );
  }
}
