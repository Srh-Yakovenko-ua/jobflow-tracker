import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { loggerParams } from './common/logger.js';
import { configModule } from './config/app-config.js';
import { AiWorkerModule } from './modules/ai/index.js';
import { MaintenanceWorkerModule } from './modules/maintenance/index.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { QueuesModule } from './queues/queues.module.js';

@Module({
  imports: [
    configModule,
    LoggerModule.forRoot(loggerParams()),
    PrismaModule,
    QueuesModule,
    MaintenanceWorkerModule,
    AiWorkerModule,
  ],
})
export class WorkerModule {}
