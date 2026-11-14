import { Module } from '@nestjs/common';

import { Clock } from '../common/clock.js';
import { ApplicationsModule } from '../modules/applications/index.js';
import { NotificationsModule } from '../modules/notifications/index.js';
import { RemindersModule } from '../modules/reminders/index.js';
import { AutoGhostScanService } from './auto-ghost-scan.service.js';
import { ScheduledJobsRepository } from './scheduled-jobs.repository.js';
import { ScheduledJobsService } from './scheduled-jobs.service.js';

@Module({
  imports: [RemindersModule, ApplicationsModule, NotificationsModule],
  providers: [ScheduledJobsRepository, ScheduledJobsService, AutoGhostScanService, Clock],
  exports: [ScheduledJobsService, AutoGhostScanService],
})
export class ScheduledJobsModule {}
