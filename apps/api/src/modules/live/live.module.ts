import { Module } from '@nestjs/common';

import { RedisModule } from '../../redis/redis.module.js';
import { LiveController } from './live.controller.js';
import { LiveHub } from './live-hub.service.js';
import { LivePublisher } from './live-publisher.js';
import { LiveTicketGuard } from './live-ticket.guard.js';
import { LiveTicketsService } from './live-tickets.service.js';

@Module({
  imports: [RedisModule],
  providers: [LivePublisher],
  exports: [LivePublisher],
})
export class LiveModule {}

@Module({
  imports: [LiveModule],
  controllers: [LiveController],
  providers: [LiveHub, LiveTicketsService, LiveTicketGuard],
})
export class LiveStreamModule {}
