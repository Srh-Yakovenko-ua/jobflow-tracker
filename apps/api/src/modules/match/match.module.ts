import { Module } from '@nestjs/common';

import { AiModule } from '../ai/index.js';
import { MatchController } from './match.controller.js';
import { MatchRepository } from './match.repository.js';
import { MatchService } from './match.service.js';
import { MatchSubscriber } from './match.subscriber.js';
import { MatchQueueService } from './match-queue.service.js';
import { MatchSettleService } from './match-settle.service.js';

@Module({
  controllers: [MatchController],
  providers: [MatchService, MatchRepository],
})
export class MatchModule {}

@Module({
  imports: [AiModule],
  providers: [MatchRepository, MatchQueueService, MatchSettleService, MatchSubscriber],
  exports: [MatchQueueService],
})
export class MatchWorkerModule {}
