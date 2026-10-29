import { Module, StandardSchemaValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';

import { AppExceptionFilter } from './common/app-exception.filter.js';
import { loggerParams } from './common/logger.js';
import { toValidationError } from './common/validation.js';
import { configModule } from './config/app-config.js';
import { ApplicationsModule } from './modules/applications/index.js';
import { AuthModule } from './modules/auth/index.js';
import { EventsModule } from './modules/events/index.js';
import { HealthModule } from './modules/health/index.js';
import { MaintenanceModule } from './modules/maintenance/index.js';
import { NotesModule } from './modules/notes/index.js';
import { SettingsModule } from './modules/settings/index.js';
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
    HealthModule,
    QueuesModule,
    MaintenanceModule,
    AuthModule,
    ApplicationsModule,
    EventsModule,
    NotesModule,
    SettingsModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AppExceptionFilter },
    {
      provide: APP_PIPE,
      useValue: new StandardSchemaValidationPipe({ exceptionFactory: toValidationError }),
    },
  ],
})
export class AppModule {}
