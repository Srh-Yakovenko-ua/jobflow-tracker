import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { loggerParams } from './common/logger.js';
import { configModule } from './config/app-config.js';
import { MaintenanceWorkerModule } from './modules/maintenance/index.js';
import { QueuesModule } from './queues/queues.module.js';

@Module({
  imports: [
    configModule,
    LoggerModule.forRoot(loggerParams()),
    QueuesModule,
    MaintenanceWorkerModule,
  ],
})
export class WorkerModule {}
