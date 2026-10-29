import { Module } from '@nestjs/common';

import { OutboxWorkerModule } from '../../outbox/outbox.module.js';
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
  imports: [OutboxWorkerModule],
  providers: [MaintenanceProcessor, MaintenanceScheduler],
})
export class MaintenanceWorkerModule {}
