import { Module } from '@nestjs/common';

import { OutboxWorkerModule } from '../../outbox/outbox.module.js';
import { RedisModule } from '../../redis/redis.module.js';
import { AnalyticsCacheService } from './analytics-cache.service.js';
import { AnalyticsCacheSubscriber } from './analytics-cache.subscriber.js';

@Module({
  imports: [RedisModule],
  providers: [AnalyticsCacheService],
  exports: [AnalyticsCacheService],
})
export class AnalyticsCacheModule {}

@Module({
  imports: [OutboxWorkerModule, AnalyticsCacheModule],
  providers: [AnalyticsCacheSubscriber],
})
export class AnalyticsCacheWorkerModule {}
