import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';

import { loggerParams } from './common/logger.js';
import { configModule } from './config/app-config.js';
import { ErrorTrackingModule } from './error-tracking/error-tracking.module.js';
import { JobFailureReporter } from './error-tracking/job-failure-reporter.js';
import { MetricsModule } from './metrics/metrics.module.js';
import { MetricsWorkerModule } from './metrics/metrics-worker.module.js';
import { AccountWorkerModule } from './modules/account/index.js';
import { AiWorkerModule } from './modules/ai/index.js';
import { AnalyticsCacheWorkerModule } from './modules/analytics-cache/index.js';
import { ApplicationsWorkerModule } from './modules/applications/index.js';
import { CaptureWorkerModule } from './modules/capture/index.js';
import { CvHintsWorkerModule } from './modules/cv-hints/index.js';
import { EmailWorkerModule } from './modules/email/index.js';
import { FollowupsWorkerModule } from './modules/followups/index.js';
import { InterviewPrepWorkerModule } from './modules/interview-prep/index.js';
import { MaintenanceWorkerModule } from './modules/maintenance/index.js';
import { MatchWorkerModule } from './modules/match/index.js';
import { NotificationsWorkerModule } from './modules/notifications/index.js';
import { PushWorkerModule } from './modules/push/index.js';
import { RemindersWorkerModule } from './modules/reminders/index.js';
import { ResumesWorkerModule } from './modules/resumes/index.js';
import { RhythmWorkerModule } from './modules/rhythm/index.js';
import { SummariesWorkerModule } from './modules/summaries/index.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { QueuesModule } from './queues/queues.module.js';

@Module({
  imports: [
    configModule,
    LoggerModule.forRoot(loggerParams()),
    PrismaModule,
    ErrorTrackingModule,
    DiscoveryModule,
    QueuesModule,
    MetricsModule,
    MetricsWorkerModule,
    MaintenanceWorkerModule,
    AiWorkerModule,
    ApplicationsWorkerModule,
    CaptureWorkerModule,
    ResumesWorkerModule,
    MatchWorkerModule,
    FollowupsWorkerModule,
    CvHintsWorkerModule,
    InterviewPrepWorkerModule,
    RhythmWorkerModule,
    SummariesWorkerModule,
    AccountWorkerModule,
    RemindersWorkerModule,
    NotificationsWorkerModule,
    PushWorkerModule,
    EmailWorkerModule,
    AnalyticsCacheWorkerModule,
  ],
  providers: [JobFailureReporter],
})
export class WorkerModule {}
