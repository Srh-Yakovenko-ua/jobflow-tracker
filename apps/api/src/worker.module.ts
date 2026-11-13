import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { loggerParams } from './common/logger.js';
import { configModule } from './config/app-config.js';
import { AiWorkerModule } from './modules/ai/index.js';
import { ApplicationsWorkerModule } from './modules/applications/index.js';
import { CaptureWorkerModule } from './modules/capture/index.js';
import { FollowupsWorkerModule } from './modules/followups/index.js';
import { MaintenanceWorkerModule } from './modules/maintenance/index.js';
import { MatchWorkerModule } from './modules/match/index.js';
import { NotificationsWorkerModule } from './modules/notifications/index.js';
import { RemindersWorkerModule } from './modules/reminders/index.js';
import { ResumesWorkerModule } from './modules/resumes/index.js';
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
    ApplicationsWorkerModule,
    CaptureWorkerModule,
    ResumesWorkerModule,
    MatchWorkerModule,
    FollowupsWorkerModule,
    RemindersWorkerModule,
    NotificationsWorkerModule,
  ],
})
export class WorkerModule {}
