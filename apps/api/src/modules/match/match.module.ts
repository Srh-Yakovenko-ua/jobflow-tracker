import { Module } from '@nestjs/common';

import { Clock } from '../../common/clock.js';
import { OutboxWorkerModule } from '../../outbox/outbox.module.js';
import { AiModule } from '../ai/index.js';
import { EventsModule } from '../events/index.js';
import { LiveModule } from '../live/index.js';
import { MatchController } from './match.controller.js';
import { MatchRepository } from './match.repository.js';
import { MatchService } from './match.service.js';
import { MatchSubscriber } from './match.subscriber.js';
import { MatchQueueService } from './match-queue.service.js';
import { MatchSettleService } from './match-settle.service.js';
import { MatchTriggerProcessor } from './match-trigger.processor.js';
import { MatchTriggerService } from './match-trigger.service.js';
import { MatchTriggerSubscriber } from './match-trigger.subscriber.js';

@Module({
  controllers: [MatchController],
  providers: [MatchService, MatchRepository],
})
export class MatchModule {}

@Module({
  providers: [MatchRepository, MatchTriggerService],
  exports: [MatchTriggerService],
})
export class MatchTriggerModule {}

@Module({
  imports: [AiModule, OutboxWorkerModule, EventsModule, LiveModule, MatchTriggerModule],
  providers: [
    Clock,
    MatchRepository,
    MatchQueueService,
    MatchSettleService,
    MatchSubscriber,
    MatchTriggerSubscriber,
    MatchTriggerProcessor,
  ],
  exports: [MatchQueueService],
})
export class MatchWorkerModule {}
