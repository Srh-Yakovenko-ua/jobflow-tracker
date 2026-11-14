import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';

import { AppExceptionFilter } from './common/app-exception.filter.js';
import { IdempotencyModule } from './common/idempotency/idempotency.module.js';
import { loggerParams } from './common/logger.js';
import { SchemaValidationPipe } from './common/validation.js';
import { configModule } from './config/app-config.js';
import { AiModule } from './modules/ai/index.js';
import { ApplicationsModule } from './modules/applications/index.js';
import { AuthModule } from './modules/auth/index.js';
import { CaptureModule } from './modules/capture/index.js';
import { ContactsModule } from './modules/contacts/index.js';
import { EventsModule } from './modules/events/index.js';
import { FollowupsModule } from './modules/followups/index.js';
import { HealthModule } from './modules/health/index.js';
import { JobsModule } from './modules/jobs/index.js';
import { LiveStreamModule } from './modules/live/index.js';
import { MaintenanceModule } from './modules/maintenance/index.js';
import { MatchModule } from './modules/match/index.js';
import { NotesModule } from './modules/notes/index.js';
import { NotificationsModule } from './modules/notifications/index.js';
import { PlansModule } from './modules/plans/index.js';
import { RemindersModule } from './modules/reminders/index.js';
import { ResumesModule } from './modules/resumes/index.js';
import { ScheduleModule } from './modules/schedule/index.js';
import { SearchesModule } from './modules/searches/index.js';
import { SettingsModule } from './modules/settings/index.js';
import { SummariesModule } from './modules/summaries/index.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { QueuesModule } from './queues/queues.module.js';
import { RateLimitModule } from './rate-limit/rate-limit.module.js';
import { RedisModule } from './redis/redis.module.js';

@Module({
  imports: [
    configModule,
    LoggerModule.forRoot(loggerParams()),
    PrismaModule,
    RedisModule,
    RateLimitModule,
    IdempotencyModule,
    HealthModule,
    QueuesModule,
    MaintenanceModule,
    AuthModule,
    ApplicationsModule,
    EventsModule,
    NotesModule,
    ContactsModule,
    ScheduleModule,
    RemindersModule,
    NotificationsModule,
    SettingsModule,
    SearchesModule,
    AiModule,
    CaptureModule,
    ResumesModule,
    MatchModule,
    FollowupsModule,
    PlansModule,
    SummariesModule,
    JobsModule,
    LiveStreamModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AppExceptionFilter },
    { provide: APP_PIPE, useClass: SchemaValidationPipe },
  ],
})
export class AppModule {}
