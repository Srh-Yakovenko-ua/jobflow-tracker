import { Module } from '@nestjs/common';

import { OutboxWorkerModule } from '../../outbox/outbox.module.js';
import { AiModule } from '../ai/index.js';
import { MatchModule } from '../match/index.js';
import { CvHintsController } from './cv-hints.controller.js';
import { CvHintsRepository } from './cv-hints.repository.js';
import { CvHintsService } from './cv-hints.service.js';
import { CvHintsSubscriber } from './cv-hints.subscriber.js';
import { CvHintsQueueService } from './cv-hints-queue.service.js';

@Module({
  imports: [AiModule, MatchModule],
  controllers: [CvHintsController],
  providers: [CvHintsRepository, CvHintsService],
})
export class CvHintsModule {}

@Module({
  imports: [AiModule, OutboxWorkerModule],
  providers: [CvHintsQueueService, CvHintsSubscriber],
})
export class CvHintsWorkerModule {}
