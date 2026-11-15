import { Module } from '@nestjs/common';

import { AnalyticsClientModule } from '../../analytics-client/index.js';
import { Clock } from '../../common/clock.js';
import { OutboxWorkerModule } from '../../outbox/outbox.module.js';
import { AiModule } from '../ai/index.js';
import { MatchModule } from '../match/index.js';
import { NotificationsModule } from '../notifications/index.js';
import { InterviewPrepController } from './interview-prep.controller.js';
import { InterviewPrepRepository } from './interview-prep.repository.js';
import { InterviewPrepService } from './interview-prep.service.js';
import { InterviewPrepSubscriber } from './interview-prep.subscriber.js';
import { InterviewPrepQueueService } from './interview-prep-queue.service.js';
import { InterviewPrepReadySubscriber } from './interview-prep-ready.subscriber.js';
import { InterviewPrepSources } from './interview-prep-sources.service.js';

@Module({
  imports: [AiModule, MatchModule],
  controllers: [InterviewPrepController],
  providers: [InterviewPrepRepository, InterviewPrepSources, InterviewPrepService, Clock],
  exports: [InterviewPrepService, InterviewPrepSources],
})
export class InterviewPrepModule {}

@Module({
  imports: [
    AiModule,
    OutboxWorkerModule,
    AnalyticsClientModule,
    NotificationsModule,
    InterviewPrepModule,
  ],
  providers: [InterviewPrepQueueService, InterviewPrepSubscriber, InterviewPrepReadySubscriber],
})
export class InterviewPrepWorkerModule {}
