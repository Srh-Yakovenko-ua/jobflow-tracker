import { Module, StandardSchemaValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';

import { AppExceptionFilter } from './common/app-exception.filter.js';
import { loggerParams } from './common/logger.js';
import { toValidationError } from './common/validation.js';
import { configModule } from './config/app-config.js';
import { HealthModule } from './modules/health/index.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RedisModule } from './redis/redis.module.js';

@Module({
  imports: [
    configModule,
    LoggerModule.forRoot(loggerParams()),
    PrismaModule,
    RedisModule,
    HealthModule,
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
