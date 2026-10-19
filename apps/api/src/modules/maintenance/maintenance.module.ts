import { Module } from '@nestjs/common';

import { MaintenanceController } from './maintenance.controller.js';
import { MaintenanceProcessor } from './maintenance.processor.js';
import { MaintenanceService } from './maintenance.service.js';

@Module({
  controllers: [MaintenanceController],
  providers: [MaintenanceService],
})
export class MaintenanceModule {}

@Module({
  providers: [MaintenanceProcessor],
})
export class MaintenanceWorkerModule {}
