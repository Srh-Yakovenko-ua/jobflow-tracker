import { Module } from '@nestjs/common';

import { Clock } from '../../common/clock.js';
import { OutboxWorkerModule } from '../../outbox/outbox.module.js';
import { AiModule } from '../ai/index.js';
import { EventsModule } from '../events/index.js';
import { RemindersModule } from '../reminders/index.js';
import { FollowupQueueService } from './followup-queue.service.js';
import { FollowupSentService } from './followup-sent.service.js';
import { FollowupsController } from './followups.controller.js';
import { FollowupsRepository } from './followups.repository.js';
import { FollowupsService } from './followups.service.js';
import { FollowupsSubscriber } from './followups.subscriber.js';

@Module({
  imports: [AiModule, EventsModule, RemindersModule],
  controllers: [FollowupsController],
  providers: [Clock, FollowupsRepository, FollowupsService, FollowupSentService],
})
export class FollowupsModule {}

@Module({
  imports: [AiModule, OutboxWorkerModule],
  providers: [FollowupQueueService, FollowupsSubscriber],
})
export class FollowupsWorkerModule {}
