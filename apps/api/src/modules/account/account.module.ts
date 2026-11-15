import { Module } from '@nestjs/common';

import { Clock } from '../../common/clock.js';
import { OutboxWorkerModule } from '../../outbox/outbox.module.js';
import { StorageModule } from '../../storage/storage.module.js';
import { AuthModule } from '../auth/index.js';
import { NotificationsModule } from '../notifications/index.js';
import { AccountController } from './account.controller.js';
import { AccountRepository } from './account.repository.js';
import { AccountService } from './account.service.js';
import { AccountDeletionService } from './account-deletion.service.js';
import { AccountExportRepository } from './account-export.repository.js';
import { AccountExportService } from './account-export.service.js';
import { AccountExportSubscriber } from './account-export.subscriber.js';

@Module({
  imports: [StorageModule, AuthModule],
  controllers: [AccountController],
  providers: [Clock, AccountRepository, AccountService, AccountDeletionService],
})
export class AccountModule {}

@Module({
  imports: [OutboxWorkerModule, StorageModule, NotificationsModule],
  providers: [AccountExportRepository, AccountExportService, AccountExportSubscriber],
  exports: [AccountExportService],
})
export class AccountWorkerModule {}
