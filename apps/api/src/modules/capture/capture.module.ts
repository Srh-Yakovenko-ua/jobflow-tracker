import { Module } from '@nestjs/common';

import { OutboxWorkerModule } from '../../outbox/outbox.module.js';
import { AiModule } from '../ai/index.js';
import { ApplicationsModule } from '../applications/index.js';
import { EventsModule } from '../events/index.js';
import { NotesModule } from '../notes/index.js';
import { CaptureController } from './capture.controller.js';
import { CaptureService } from './capture.service.js';
import { CaptureParseService } from './capture-parse.service.js';
import { CaptureQueueService } from './capture-queue.service.js';
import { CaptureSubscriber } from './capture-subscriber.service.js';

@Module({
  imports: [ApplicationsModule, AiModule, EventsModule],
  controllers: [CaptureController],
  providers: [CaptureService],
})
export class CaptureModule {}

@Module({
  imports: [OutboxWorkerModule, AiModule, ApplicationsModule, EventsModule, NotesModule],
  providers: [CaptureQueueService, CaptureParseService, CaptureSubscriber],
})
export class CaptureWorkerModule {}
