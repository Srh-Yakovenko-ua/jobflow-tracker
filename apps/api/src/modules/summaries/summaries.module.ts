import { Module } from '@nestjs/common';

import { AnalyticsClientModule } from '../../analytics-client/index.js';
import { Clock } from '../../common/clock.js';
import { OutboxWorkerModule } from '../../outbox/outbox.module.js';
import { AiModule } from '../ai/index.js';
import { PlansModule } from '../plans/index.js';
import { SummariesController } from './summaries.controller.js';
import { SummariesRepository } from './summaries.repository.js';
import { SummariesService } from './summaries.service.js';
import { SummariesSubscriber } from './summaries.subscriber.js';
import { SummaryQueueService } from './summary-queue.service.js';
import { SummaryRequestsService } from './summary-requests.service.js';

@Module({
  imports: [AiModule, PlansModule],
  controllers: [SummariesController],
  providers: [Clock, SummariesRepository, SummariesService, SummaryRequestsService],
  exports: [SummaryRequestsService],
})
export class SummariesModule {}

@Module({
  imports: [AiModule, OutboxWorkerModule, AnalyticsClientModule, PlansModule],
  providers: [SummaryQueueService, SummariesSubscriber],
})
export class SummariesWorkerModule {}
