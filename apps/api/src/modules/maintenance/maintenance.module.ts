import { Module } from '@nestjs/common';

import { OutboxWorkerModule } from '../../outbox/outbox.module.js';
import { ScheduledJobsModule } from '../../scheduled-jobs/scheduled-jobs.module.js';
import { MaintenanceController } from './maintenance.controller.js';
import { MaintenanceProcessor } from './maintenance.processor.js';
import { MaintenanceScheduler } from './maintenance.scheduler.js';
import { MaintenanceService } from './maintenance.service.js';

@Module({
  controllers: [MaintenanceController],
  providers: [MaintenanceService],
})
export class MaintenanceModule {}

@Module({
  imports: [OutboxWorkerModule, ScheduledJobsModule],
  providers: [MaintenanceProcessor, MaintenanceScheduler],
})
export class MaintenanceWorkerModule {}
