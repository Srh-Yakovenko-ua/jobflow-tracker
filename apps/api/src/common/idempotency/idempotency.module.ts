import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { Clock } from '../clock.js';
import { IdempotencyInterceptor } from './idempotency.interceptor.js';
import { IdempotencyRepository } from './idempotency.repository.js';
import { IdempotencyService } from './idempotency.service.js';

@Module({
  providers: [
    IdempotencyRepository,
    IdempotencyService,
    Clock,
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
})
export class IdempotencyModule {}
